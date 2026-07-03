use std::{
    fs,
    hash::{DefaultHasher, Hash, Hasher},
    path::{Path, PathBuf},
    time::Duration as StdDuration,
};

use regex::Regex;
use reqwest::Url;
use serde::Serialize;

const LINK_PREVIEW_USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 MermaidCanvasEditor/0.1";
const MAX_HTML_BYTES: u64 = 2_000_000;
const MAX_IMAGE_BYTES: u64 = 8_000_000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkPreviewCover {
    src: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    height: Option<u32>,
    persistent: bool,
}

#[derive(Serialize)]
#[serde(
    tag = "status",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum LinkPreviewResponse {
    #[serde(rename = "ready")]
    Ready {
        provider: String,
        source_url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        canonical_url: Option<String>,
        title: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        cover: Option<LinkPreviewCover>,
    },
    #[serde(rename = "fallback")]
    Fallback {
        provider: String,
        source_url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        canonical_url: Option<String>,
        title: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        cover: Option<LinkPreviewCover>,
        #[serde(skip_serializing_if = "Option::is_none")]
        message: Option<String>,
    },
    #[serde(rename = "unsupported")]
    Unsupported { message: String },
}

#[tauri::command]
pub async fn resolve_link_preview(
    plugin_id: String,
    url: String,
    document_path: Option<String>,
) -> Result<LinkPreviewResponse, String> {
    if plugin_id != "xiaohongshu" {
        return Ok(LinkPreviewResponse::Unsupported {
            message: "该内容插件不支持桌面抓取。".to_string(),
        });
    }

    resolve_xiaohongshu_link_preview(url, document_path).await
}

async fn resolve_xiaohongshu_link_preview(
    raw_url: String,
    document_path: Option<String>,
) -> Result<LinkPreviewResponse, String> {
    let source_url = raw_url.trim().to_string();
    let parsed = Url::parse(&source_url).map_err(readable_error)?;
    if !is_allowed_xiaohongshu_host(parsed.host_str().unwrap_or("")) {
        return Ok(link_preview_fallback(source_url, None, "不是小红书链接。"));
    }

    let client = reqwest::Client::builder()
        .timeout(StdDuration::from_secs(8))
        .redirect(reqwest::redirect::Policy::limited(5))
        .user_agent(LINK_PREVIEW_USER_AGENT)
        .build()
        .map_err(readable_error)?;
    let response = match client
        .get(parsed)
        .header(
            reqwest::header::ACCEPT,
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        )
        .header(reqwest::header::ACCEPT_LANGUAGE, "zh-CN,zh;q=0.9,en;q=0.5")
        .send()
        .await
    {
        Ok(response) => response,
        Err(_) => {
            return Ok(link_preview_fallback(
                source_url,
                None,
                "小红书页面暂时无法访问。",
            ))
        }
    };
    let final_url = response.url().clone();
    if !is_allowed_xiaohongshu_host(final_url.host_str().unwrap_or("")) {
        return Ok(link_preview_fallback(
            source_url,
            None,
            "小红书短链跳转目标不受支持。",
        ));
    }
    if response.content_length().unwrap_or(0) > MAX_HTML_BYTES {
        return Ok(link_preview_fallback(
            source_url,
            Some(final_url.to_string()),
            "小红书页面过大，已生成链接卡片。",
        ));
    }

    let html = match response.text().await {
        Ok(text) => text,
        Err(_) => {
            return Ok(link_preview_fallback(
                source_url,
                Some(final_url.to_string()),
                "小红书页面读取失败。",
            ))
        }
    };
    let title = first_non_empty(&[
        extract_meta(&html, "og:title"),
        extract_meta(&html, "twitter:title"),
        extract_title(&html),
    ])
    .unwrap_or_else(|| "小红书笔记".to_string());
    let cover_candidates = extract_xiaohongshu_preview_cover_urls(&html, &final_url);
    let canonical_url = extract_meta(&html, "og:url")
        .and_then(|value| final_url.join(&value).ok())
        .map(|value| value.to_string())
        .unwrap_or_else(|| final_url.to_string());
    let cover =
        resolve_preview_cover_candidates(&client, cover_candidates, document_path.as_deref()).await;

    Ok(LinkPreviewResponse::Ready {
        provider: "小红书".to_string(),
        source_url,
        canonical_url: Some(canonical_url),
        title: clean_preview_text(&title),
        cover,
    })
}

async fn resolve_preview_cover_candidates(
    client: &reqwest::Client,
    cover_urls: Vec<String>,
    document_path: Option<&str>,
) -> Option<LinkPreviewCover> {
    for cover_url in cover_urls {
        if let Some(cover) = resolve_preview_cover(client, cover_url, document_path).await {
            return Some(cover);
        }
    }
    None
}

async fn resolve_preview_cover(
    client: &reqwest::Client,
    cover_url: String,
    document_path: Option<&str>,
) -> Option<LinkPreviewCover> {
    let response = match client
        .get(&cover_url)
        .header(
            reqwest::header::ACCEPT,
            "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        )
        .header(reqwest::header::REFERER, "https://www.xiaohongshu.com/")
        .send()
        .await
    {
        Ok(response) => response,
        Err(_) => return None,
    };
    if !response.status().is_success() {
        return None;
    }
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    let extension = preview_image_extension(&content_type, &cover_url)?;
    if response.content_length().unwrap_or(0) > MAX_IMAGE_BYTES {
        return None;
    }
    let bytes = match response.bytes().await {
        Ok(bytes) => bytes,
        Err(_) => return None,
    };
    if bytes.len() > MAX_IMAGE_BYTES as usize {
        return None;
    }
    let (width, height) = preview_image_dimensions(&content_type, &bytes)?;

    let file_name = format!("xiaohongshu-{}.{}", short_text_hash(&cover_url), extension);
    let (src, persistent) =
        match write_preview_asset_or_cache(document_path, file_name, &bytes).await {
            Ok(result) => result,
            Err(_) => return None,
        };

    Some(LinkPreviewCover {
        src,
        width: Some(width),
        height: Some(height),
        persistent,
    })
}

async fn write_preview_asset_or_cache(
    document_path: Option<&str>,
    file_name: String,
    bytes: &[u8],
) -> Result<(String, bool), String> {
    if let Some(document_path) = document_path {
        let document = PathBuf::from(document_path);
        if is_supported_image_document_path(&document) {
            return write_preview_asset(document, file_name, bytes)
                .await
                .map(|src| (src, true));
        }
    };

    write_preview_cache_asset(file_name, bytes)
        .await
        .map(|src| (src, false))
}

async fn write_preview_asset(
    document_path: PathBuf,
    file_name: String,
    bytes: &[u8],
) -> Result<String, String> {
    let document_dir = document_path.parent().unwrap_or_else(|| Path::new("."));
    let destination_dir = document_dir
        .join("assets")
        .join(document_stem(&document_path))
        .join("link-previews");
    fs::create_dir_all(&destination_dir).map_err(readable_error)?;
    let destination = destination_dir.join(file_name);
    tokio::fs::write(&destination, bytes)
        .await
        .map_err(readable_error)?;
    Ok(relative_asset_src(document_dir, &destination))
}

async fn write_preview_cache_asset(file_name: String, bytes: &[u8]) -> Result<String, String> {
    let destination_dir = link_preview_cache_dir()?;
    fs::create_dir_all(&destination_dir).map_err(readable_error)?;
    let destination = destination_dir.join(file_name);
    tokio::fs::write(&destination, bytes)
        .await
        .map_err(readable_error)?;
    Ok(path_to_string(&destination))
}

fn is_allowed_xiaohongshu_host(host: &str) -> bool {
    let host = host.to_ascii_lowercase();
    host == "xhslink.com"
        || host.ends_with(".xhslink.com")
        || host == "xiaohongshu.com"
        || host.ends_with(".xiaohongshu.com")
}

fn link_preview_fallback(
    source_url: String,
    canonical_url: Option<String>,
    message: &str,
) -> LinkPreviewResponse {
    LinkPreviewResponse::Fallback {
        provider: "小红书".to_string(),
        source_url,
        canonical_url,
        title: "小红书笔记".to_string(),
        cover: None,
        message: Some(message.to_string()),
    }
}

fn extract_meta(html: &str, key: &str) -> Option<String> {
    let pattern = Regex::new(r#"(?is)<meta\b[^>]*>"#).ok()?;
    for tag in pattern
        .find_iter(html)
        .map(|match_item| match_item.as_str())
    {
        let property =
            extract_html_attr(tag, "property").or_else(|| extract_html_attr(tag, "name"));
        if property
            .as_deref()
            .map(|value| value.eq_ignore_ascii_case(key))
            != Some(true)
        {
            continue;
        }
        if let Some(content) =
            extract_html_attr(tag, "content").map(|value| clean_preview_text(&value))
        {
            if !content.is_empty() {
                return Some(content);
            }
        }
    }
    None
}

fn extract_html_attr(tag: &str, name: &str) -> Option<String> {
    let pattern = Regex::new(&format!(
        r#"(?is)\b{}\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))"#,
        regex::escape(name)
    ))
    .ok()?;
    let captures = pattern.captures(tag)?;
    let value = captures
        .get(2)
        .or_else(|| captures.get(3))
        .or_else(|| captures.get(4))?
        .as_str();
    Some(decode_basic_html_entities(value))
}

fn extract_title(html: &str) -> Option<String> {
    let captures = Regex::new(r#"(?is)<title[^>]*>(.*?)</title>"#)
        .ok()?
        .captures(html)?;
    captures
        .get(1)
        .map(|value| clean_preview_text(&decode_basic_html_entities(value.as_str())))
}

#[cfg(test)]
fn extract_xiaohongshu_preview_cover_url(html: &str, base_url: &Url) -> Option<String> {
    extract_xiaohongshu_preview_cover_urls(html, base_url)
        .into_iter()
        .next()
}

fn extract_xiaohongshu_preview_cover_urls(html: &str, base_url: &Url) -> Vec<String> {
    let mut candidates = Vec::new();
    append_resolved_xiaohongshu_images(
        &mut candidates,
        base_url,
        extract_meta_values(html, "property", "og:image"),
    );
    append_resolved_xiaohongshu_images(
        &mut candidates,
        base_url,
        extract_meta_values(html, "property", "og:image:url"),
    );
    append_resolved_xiaohongshu_images(
        &mut candidates,
        base_url,
        extract_meta_values(html, "property", "twitter:image"),
    );
    append_resolved_xiaohongshu_images(
        &mut candidates,
        base_url,
        extract_meta_values(html, "name", "twitter:image"),
    );
    append_unique_strings(
        &mut candidates,
        extract_xiaohongshu_cover_urls(html, base_url),
    );
    append_resolved_xiaohongshu_images(
        &mut candidates,
        base_url,
        extract_meta_values(html, "name", "og:image"),
    );
    append_resolved_xiaohongshu_images(
        &mut candidates,
        base_url,
        extract_meta_values(html, "name", "og:image:url"),
    );
    append_resolved_xiaohongshu_images(
        &mut candidates,
        base_url,
        extract_meta_values(html, "itemprop", "image"),
    );
    candidates
}

fn append_resolved_xiaohongshu_images(
    candidates: &mut Vec<String>,
    base_url: &Url,
    values: Vec<String>,
) {
    append_unique_strings(
        candidates,
        values
            .into_iter()
            .filter_map(|value| resolve_xiaohongshu_image_url(base_url, &value)),
    );
}

fn append_unique_strings(candidates: &mut Vec<String>, values: impl IntoIterator<Item = String>) {
    for value in values {
        if !candidates.iter().any(|candidate| candidate == &value) {
            candidates.push(value);
        }
    }
}

fn extract_meta_values(html: &str, attribute_name: &str, key: &str) -> Vec<String> {
    let Some(pattern) = Regex::new(r#"(?is)<meta\b[^>]*>"#).ok() else {
        return Vec::new();
    };
    pattern
        .find_iter(html)
        .filter_map(|match_item| {
            let tag = match_item.as_str();
            let property = extract_html_attr(tag, attribute_name)?;
            if !property.eq_ignore_ascii_case(key) {
                return None;
            }
            let content =
                extract_html_attr(tag, "content").map(|value| clean_preview_text(&value))?;
            if content.is_empty() {
                return None;
            }
            Some(content)
        })
        .collect()
}

fn resolve_xiaohongshu_image_url(base_url: &Url, value: &str) -> Option<String> {
    let joined = base_url.join(value.trim()).ok()?;
    let url = clean_embedded_url_candidate(joined.as_str());
    is_likely_xiaohongshu_image_url(&url).then_some(url)
}

#[derive(Clone)]
struct ImageCandidate {
    url: String,
    score: i32,
    index: usize,
}

#[cfg(test)]
fn extract_xiaohongshu_cover_url(html: &str) -> Option<String> {
    let base_url = Url::parse("https://www.xiaohongshu.com/").ok()?;
    extract_xiaohongshu_cover_urls(html, &base_url)
        .into_iter()
        .next()
}

fn extract_xiaohongshu_cover_urls(html: &str, base_url: &Url) -> Vec<String> {
    let normalized = normalize_embedded_url_text(html);
    let Some(pattern) = Regex::new(r#"(?i)(?:https?:)?//[^\s"'<>),;}\\]+"#).ok() else {
        return Vec::new();
    };
    let mut candidates: Vec<ImageCandidate> = Vec::new();

    for match_item in pattern.find_iter(&normalized) {
        let Some(url) = resolve_xiaohongshu_image_url(base_url, match_item.as_str()) else {
            continue;
        };
        if !is_likely_xiaohongshu_image_url(&url)
            || candidates.iter().any(|candidate| candidate.url == url)
        {
            continue;
        }
        let context = lossy_ascii_window(&normalized, match_item.start(), match_item.end(), 220);
        let score = xiaohongshu_image_score(&url, &context);
        if score < 0 {
            continue;
        }
        candidates.push(ImageCandidate {
            url,
            score,
            index: match_item.start(),
        });
    }

    candidates.sort_by(|left, right| {
        right
            .score
            .cmp(&left.score)
            .then(left.index.cmp(&right.index))
    });
    candidates
        .into_iter()
        .map(|candidate| candidate.url)
        .collect()
}

fn normalize_embedded_url_text(value: &str) -> String {
    let mut normalized = decode_basic_html_entities(value);
    for (from, to) in [
        ("\\\\u002F", "/"),
        ("\\\\u002f", "/"),
        ("\\u002F", "/"),
        ("\\u002f", "/"),
        ("\\\\u0026", "&"),
        ("\\u0026", "&"),
        ("\\\\u003D", "="),
        ("\\\\u003d", "="),
        ("\\u003D", "="),
        ("\\u003d", "="),
        ("\\\\u003A", ":"),
        ("\\\\u003a", ":"),
        ("\\u003A", ":"),
        ("\\u003a", ":"),
        ("\\\\/", "/"),
        ("\\/", "/"),
    ] {
        normalized = normalized.replace(from, to);
    }
    normalized
}

fn clean_embedded_url_candidate(value: &str) -> String {
    let mut cleaned = decode_basic_html_entities(value).trim().to_string();
    if let Some(index) = cleaned.find(|character| matches!(character, ')' | ']' | '}' | ';')) {
        cleaned.truncate(index);
    }
    while cleaned
        .chars()
        .last()
        .map(|character| matches!(character, ',' | '.' | ')' | ']' | '}' | ';' | '\\'))
        .unwrap_or(false)
    {
        cleaned.pop();
    }
    upgrade_xiaohongshu_image_url_scheme(&cleaned).unwrap_or(cleaned)
}

fn lossy_ascii_window(value: &str, start: usize, end: usize, radius: usize) -> String {
    let bytes = value.as_bytes();
    let from = start.saturating_sub(radius);
    let to = end.saturating_add(radius).min(bytes.len());
    String::from_utf8_lossy(&bytes[from..to]).to_ascii_lowercase()
}

fn is_likely_xiaohongshu_image_url(url: &str) -> bool {
    let Ok(parsed) = Url::parse(url) else {
        return false;
    };
    if parsed.scheme() != "https" && parsed.scheme() != "http" {
        return false;
    }
    if parsed.path() == "/" || parsed.path().is_empty() {
        return false;
    }
    let host = parsed.host_str().unwrap_or("").to_ascii_lowercase();
    if !is_xiaohongshu_image_host(&host) {
        return false;
    }

    let lower = url.to_ascii_lowercase();
    ![
        "avatar", "profile", "favicon", "icon", "logo", "emoji", "sprite", ".svg", ".ico",
    ]
    .iter()
    .any(|marker| lower.contains(marker))
}

fn xiaohongshu_image_score(url: &str, context: &str) -> i32 {
    let lower = url.to_ascii_lowercase();
    let mut score = 20;

    for marker in ["sns-img", "sns-webpic", "ci.xiaohongshu.com"] {
        if lower.contains(marker) {
            score += 24;
        }
    }
    for marker in [
        "notes_pre_post",
        "/note/",
        "imageview2",
        "format=",
        "width=",
        "height=",
    ] {
        if lower.contains(marker) {
            score += 8;
        }
    }
    if lower.contains("nd_dft") {
        score += 24;
    }
    if lower.contains("nd_prv") {
        score -= 12;
    }
    for marker in [
        "imagelist",
        "url_default",
        "urldefault",
        "urlpre",
        "cover",
        "poster",
        "thumbnail",
        "note_card",
        "notecard",
        "traceid",
        "image_info",
        "background-image",
        "player",
        "player-container",
        "browser-player",
        "media",
        "mediav2",
        "video",
    ] {
        if context.contains(marker) {
            score += 12;
        }
    }
    for marker in [
        "avatar",
        "profile",
        "user_avatar",
        "author",
        "favicon",
        "logo",
        "icon",
    ] {
        if context.contains(marker) {
            score -= 18;
        }
    }

    score + (lower.len() as i32 / 80).min(8)
}

fn clean_preview_text(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn decode_basic_html_entities(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

fn first_non_empty(values: &[Option<String>]) -> Option<String> {
    values
        .iter()
        .filter_map(|value| value.as_ref())
        .find(|value| !value.trim().is_empty())
        .cloned()
}

fn preview_image_extension(content_type: &str, url: &str) -> Option<&'static str> {
    let content_type = content_type.to_ascii_lowercase();
    if content_type.contains("image/png") {
        return Some("png");
    }
    if content_type.contains("image/jpeg") || content_type.contains("image/jpg") {
        return Some("jpg");
    }
    if content_type.contains("image/webp") {
        return Some("webp");
    }
    if content_type.contains("image/gif") {
        return Some("gif");
    }

    let parsed = Url::parse(url).ok()?;
    let path = parsed.path().to_ascii_lowercase();
    if path.ends_with(".png") {
        return Some("png");
    }
    if path.ends_with(".jpg") || path.ends_with(".jpeg") {
        return Some("jpg");
    }
    if path.ends_with(".webp") {
        return Some("webp");
    }
    if path.ends_with(".gif") {
        return Some("gif");
    }
    let query = parsed.query().unwrap_or("").to_ascii_lowercase();
    if query.contains("format=png") {
        return Some("png");
    }
    if query.contains("format=jpg") || query.contains("format=jpeg") {
        return Some("jpg");
    }
    if query.contains("format=webp") {
        return Some("webp");
    }
    if is_xiaohongshu_image_host(parsed.host_str().unwrap_or("")) {
        return Some("jpg");
    }
    None
}

fn preview_image_dimensions(content_type: &str, bytes: &[u8]) -> Option<(u32, u32)> {
    let content_type = content_type.to_ascii_lowercase();
    if content_type.contains("image/png") || bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return png_dimensions(bytes);
    }
    if content_type.contains("image/jpeg")
        || content_type.contains("image/jpg")
        || bytes.starts_with(&[0xff, 0xd8])
    {
        return jpeg_dimensions(bytes);
    }
    if content_type.contains("image/webp") || bytes.get(0..4) == Some(b"RIFF") {
        return webp_dimensions(bytes);
    }
    if content_type.contains("image/gif")
        || bytes.starts_with(b"GIF87a")
        || bytes.starts_with(b"GIF89a")
    {
        return gif_dimensions(bytes);
    }
    None
}

fn png_dimensions(bytes: &[u8]) -> Option<(u32, u32)> {
    if bytes.len() < 24
        || !bytes.starts_with(b"\x89PNG\r\n\x1a\n")
        || bytes.get(12..16) != Some(b"IHDR")
    {
        return None;
    }
    let width = u32::from_be_bytes(bytes.get(16..20)?.try_into().ok()?);
    let height = u32::from_be_bytes(bytes.get(20..24)?.try_into().ok()?);
    nonzero_dimensions(width, height)
}

fn jpeg_dimensions(bytes: &[u8]) -> Option<(u32, u32)> {
    if !bytes.starts_with(&[0xff, 0xd8]) {
        return None;
    }
    let mut index = 2;
    while index + 3 < bytes.len() {
        while index < bytes.len() && bytes[index] != 0xff {
            index += 1;
        }
        while index < bytes.len() && bytes[index] == 0xff {
            index += 1;
        }
        if index >= bytes.len() {
            return None;
        }
        let marker = bytes[index];
        index += 1;
        if marker == 0xd9 || marker == 0xda {
            return None;
        }
        if marker == 0x01 || (0xd0..=0xd7).contains(&marker) {
            continue;
        }
        if index + 1 >= bytes.len() {
            return None;
        }
        let segment_len =
            u16::from_be_bytes(bytes.get(index..index + 2)?.try_into().ok()?) as usize;
        if segment_len < 2 || index + segment_len > bytes.len() {
            return None;
        }
        if is_jpeg_sof_marker(marker) && segment_len >= 7 {
            let height =
                u16::from_be_bytes(bytes.get(index + 3..index + 5)?.try_into().ok()?) as u32;
            let width =
                u16::from_be_bytes(bytes.get(index + 5..index + 7)?.try_into().ok()?) as u32;
            return nonzero_dimensions(width, height);
        }
        index += segment_len;
    }
    None
}

fn is_jpeg_sof_marker(marker: u8) -> bool {
    matches!(
        marker,
        0xc0 | 0xc1 | 0xc2 | 0xc3 | 0xc5 | 0xc6 | 0xc7 | 0xc9 | 0xca | 0xcb | 0xcd | 0xce | 0xcf
    )
}

fn webp_dimensions(bytes: &[u8]) -> Option<(u32, u32)> {
    if bytes.len() < 30 || bytes.get(0..4) != Some(b"RIFF") || bytes.get(8..12) != Some(b"WEBP") {
        return None;
    }
    let chunk = bytes.get(12..16)?;
    let data = bytes.get(20..)?;
    if chunk == b"VP8X" {
        let width = 1
            + u32::from(data.get(4).copied()?)
            + (u32::from(data.get(5).copied()?) << 8)
            + (u32::from(data.get(6).copied()?) << 16);
        let height = 1
            + u32::from(data.get(7).copied()?)
            + (u32::from(data.get(8).copied()?) << 8)
            + (u32::from(data.get(9).copied()?) << 16);
        return nonzero_dimensions(width, height);
    }
    if chunk == b"VP8L" {
        if data.first().copied()? != 0x2f {
            return None;
        }
        let b1 = u32::from(data.get(1).copied()?);
        let b2 = u32::from(data.get(2).copied()?);
        let b3 = u32::from(data.get(3).copied()?);
        let b4 = u32::from(data.get(4).copied()?);
        let width = 1 + (((b2 & 0x3f) << 8) | b1);
        let height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
        return nonzero_dimensions(width, height);
    }
    if chunk == b"VP8 " {
        if data.get(3..6) != Some(&[0x9d, 0x01, 0x2a][..]) {
            return None;
        }
        let width = u16::from_le_bytes(data.get(6..8)?.try_into().ok()?) as u32 & 0x3fff;
        let height = u16::from_le_bytes(data.get(8..10)?.try_into().ok()?) as u32 & 0x3fff;
        return nonzero_dimensions(width, height);
    }
    None
}

fn gif_dimensions(bytes: &[u8]) -> Option<(u32, u32)> {
    if bytes.len() < 10 || (!bytes.starts_with(b"GIF87a") && !bytes.starts_with(b"GIF89a")) {
        return None;
    }
    let width = u16::from_le_bytes(bytes.get(6..8)?.try_into().ok()?) as u32;
    let height = u16::from_le_bytes(bytes.get(8..10)?.try_into().ok()?) as u32;
    nonzero_dimensions(width, height)
}

fn nonzero_dimensions(width: u32, height: u32) -> Option<(u32, u32)> {
    (width > 0 && height > 0).then_some((width, height))
}

fn is_xiaohongshu_image_host(host: &str) -> bool {
    let host = host.to_ascii_lowercase();
    (host.ends_with(".xhscdn.com")
        && (host.starts_with("sns-img") || host.starts_with("sns-webpic")))
        || host == "ci.xiaohongshu.com"
        || host.ends_with(".ci.xiaohongshu.com")
}

fn upgrade_xiaohongshu_image_url_scheme(url: &str) -> Option<String> {
    let mut parsed = Url::parse(url).ok()?;
    if parsed.scheme() != "http" || !is_xiaohongshu_image_host(parsed.host_str().unwrap_or("")) {
        return None;
    }
    parsed.set_scheme("https").ok()?;
    Some(parsed.to_string())
}

fn is_supported_image_document_path(path: &Path) -> bool {
    is_supported_mermaid_path(path) || is_supported_canvas_path(path)
}

fn is_supported_mermaid_path(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|extension| {
            extension.eq_ignore_ascii_case("mmd") || extension.eq_ignore_ascii_case("mermaid")
        })
        .unwrap_or(false)
}

fn is_supported_canvas_path(path: &Path) -> bool {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(|name| name.to_ascii_lowercase().ends_with(".canvas.json"))
        .unwrap_or(false)
}

fn document_stem(path: &Path) -> String {
    path.file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("diagram")
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect()
}

fn link_preview_cache_dir() -> Result<PathBuf, String> {
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .ok_or_else(|| "Cannot resolve home directory.".to_string())?;
    Ok(home.join(".mermaid-canvas-editor").join("link-previews"))
}

fn relative_asset_src(base_dir: &Path, asset_path: &Path) -> String {
    asset_path
        .strip_prefix(base_dir)
        .map(path_to_string)
        .unwrap_or_else(|_| path_to_string(asset_path))
        .replace('\\', "/")
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn short_text_hash(value: &str) -> String {
    let mut hasher = DefaultHasher::new();
    value.hash(&mut hasher);
    format!("{:x}", hasher.finish()).chars().take(8).collect()
}

fn readable_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_xiaohongshu_cover_from_escaped_json() {
        let html = r#"
            <script>
              window.__INITIAL_STATE__="{\"noteCard\":{\"imageList\":[{\"urlDefault\":\"https:\/\/sns-img-qc.xhscdn.com\/notes_pre_post\/abc123?imageView2/2/w/1080/format/jpg\"}]}}";
            </script>
        "#;

        assert_eq!(
            extract_xiaohongshu_cover_url(html).as_deref(),
            Some("https://sns-img-qc.xhscdn.com/notes_pre_post/abc123?imageView2/2/w/1080/format/jpg")
        );
    }

    #[test]
    fn avoids_xiaohongshu_avatar_candidates() {
        let html = r#"
            <script>
              window.__INITIAL_STATE__ = {
                "avatar":"https:\/\/sns-img-qc.xhscdn.com\/avatar\/user.jpg",
                "imageList":[{"urlDefault":"https:\/\/sns-webpic-qc.xhscdn.com\/notes_pre_post\/cover-1"}]
              };
            </script>
        "#;

        assert_eq!(
            extract_xiaohongshu_cover_url(html).as_deref(),
            Some("https://sns-webpic-qc.xhscdn.com/notes_pre_post/cover-1")
        );
    }

    #[test]
    fn extracts_note_image_without_css_suffix_and_upgrades_https() {
        let html = r#"
            <style>
              .note-cover{background-image:url("http://sns-webpic-qc.xhscdn.com/202607031205/36faa13b7ccb78127db0245cd34e0db0/1040g00831os97ipuhq005paunskgmqfse41a0m8!nd_prv_wlteh_jpg_3");background-repeat:no-repeat}
            </style>
            <script>
              window.__INITIAL_STATE__={"note":{"imageList":[{"urlDefault":"http:\u002F\u002Fsns-webpic-qc.xhscdn.com\u002F202607031205\u002F91cce1b8cf64211d3612c19db150a884\u002F1040g00831os97ipuhq005paunskgmqfse41a0m8!nd_dft_wlteh_jpg_3"}]}};
            </script>
        "#;

        assert_eq!(
            extract_xiaohongshu_cover_url(html).as_deref(),
            Some("https://sns-webpic-qc.xhscdn.com/202607031205/91cce1b8cf64211d3612c19db150a884/1040g00831os97ipuhq005paunskgmqfse41a0m8!nd_dft_wlteh_jpg_3")
        );
    }

    #[test]
    fn ignores_non_image_xhscdn_assets() {
        let html = r#"
            <script src="https://fe-static.xhscdn.com/formula-static/xhs-pc-web/public/resource/js/index.fea72dfc.js"></script>
            <script>
              window.__INITIAL_STATE__={"note":{"imageList":[{"urlDefault":"https:\u002F\u002Fsns-webpic-qc.xhscdn.com\u002Fnotes_pre_post\u002Fcover-2"}]}};
            </script>
        "#;

        assert_eq!(
            extract_xiaohongshu_cover_url(html).as_deref(),
            Some("https://sns-webpic-qc.xhscdn.com/notes_pre_post/cover-2")
        );
    }

    #[test]
    fn prefers_real_property_og_image_over_default_name_og_image() {
        let base_url = Url::parse("https://www.xiaohongshu.com/explore/691724fc000000000400711a?xsec_token=token&xsec_source=pc_search").unwrap();
        let html = r#"
            <meta name="og:image" content="//picasso-static.xiaohongshu.com/fe-platform/default.png">
            <meta property="og:image" content="http://sns-webpic-qc.xhscdn.com/202607031428/c036fe0058372e1794eb5985e1400c4e/1040g00831os97ipuhq005paunskgmqfse41a0m8!nd_dft_wlteh_jpg_3">
        "#;

        assert_eq!(
            extract_xiaohongshu_preview_cover_url(html, &base_url).as_deref(),
            Some("https://sns-webpic-qc.xhscdn.com/202607031428/c036fe0058372e1794eb5985e1400c4e/1040g00831os97ipuhq005paunskgmqfse41a0m8!nd_dft_wlteh_jpg_3")
        );
    }

    #[test]
    fn extracts_note_detail_map_cover_when_meta_only_has_default_assets() {
        let base_url = Url::parse(
            "https://www.xiaohongshu.com/explore/abc?xsec_token=token&xsec_source=pc_search",
        )
        .unwrap();
        let html = r#"
            <meta name="og:image" content="//picasso-static.xiaohongshu.com/fe-platform/default.png">
            <script>
              window.__INITIAL_STATE__={"note":{"noteDetailMap":{"abc":{"note":{"imageList":[{"urlPre":"http:\u002F\u002Fsns-webpic-qc.xhscdn.com\u002Fnotes_pre_post\u002Fpreview!nd_prv_wlteh_jpg_3","urlDefault":"http:\u002F\u002Fsns-webpic-qc.xhscdn.com\u002Fnotes_pre_post\u002Fcover-3!nd_dft_wlteh_jpg_3"}]}}}}};
            </script>
        "#;

        assert_eq!(
            extract_xiaohongshu_preview_cover_url(html, &base_url).as_deref(),
            Some("https://sns-webpic-qc.xhscdn.com/notes_pre_post/cover-3!nd_dft_wlteh_jpg_3")
        );
    }

    #[test]
    fn extracts_video_cover_from_protocol_relative_poster() {
        let base_url = Url::parse("https://www.xiaohongshu.com/explore/video-note").unwrap();
        let html = r#"
            <video poster="//sns-webpic-qc.xhscdn.com/notes_pre_post/video-cover!nd_dft_wlteh_jpg_3"></video>
        "#;

        assert_eq!(
            extract_xiaohongshu_preview_cover_url(html, &base_url).as_deref(),
            Some("https://sns-webpic-qc.xhscdn.com/notes_pre_post/video-cover!nd_dft_wlteh_jpg_3")
        );
    }

    #[test]
    fn orders_video_cover_candidates_for_download_retry() {
        let base_url = Url::parse("https://www.xiaohongshu.com/explore/video-note").unwrap();
        let html = r#"
            <meta property="og:image" content="//sns-webpic-qc.xhscdn.com/notes_pre_post/primary-cover!nd_dft_wlteh_jpg_3">
            <script>
              window.__INITIAL_STATE__={
                "note":{"type":"video","imageList":[
                  {"urlDefault":"http:\u002F\u002Fsns-webpic-qc.xhscdn.com\u002Fnotes_pre_post\u002Fstate-cover!nd_dft_wlteh_jpg_3"}
                ]}
              };
            </script>
        "#;

        assert_eq!(
            extract_xiaohongshu_preview_cover_urls(html, &base_url),
            vec![
                "https://sns-webpic-qc.xhscdn.com/notes_pre_post/primary-cover!nd_dft_wlteh_jpg_3"
                    .to_string(),
                "https://sns-webpic-qc.xhscdn.com/notes_pre_post/state-cover!nd_dft_wlteh_jpg_3"
                    .to_string()
            ]
        );
    }

    #[test]
    fn ignores_video_thumbnail_file_id_without_public_image_url() {
        let base_url = Url::parse("https://www.xiaohongshu.com/explore/video-note").unwrap();
        let html = r#"
            <script>
              window.__INITIAL_STATE__={"note":{"type":"video","video":{"media":{"image":{"thumbnailFileid":"frame/110/0/abc_0.webp"}}}}};
            </script>
        "#;

        assert!(extract_xiaohongshu_preview_cover_urls(html, &base_url).is_empty());
    }

    #[test]
    fn ignores_xiaohongshu_default_meta_images_as_covers() {
        let base_url = Url::parse("https://www.xiaohongshu.com/explore/abc").unwrap();
        let html = r#"
            <meta name="og:image" content="//picasso-static.xiaohongshu.com/fe-platform/default.png">
            <meta itemprop="image" content="//picasso-static.xiaohongshu.com/fe-platform/item.png">
        "#;

        assert_eq!(
            extract_xiaohongshu_preview_cover_url(html, &base_url).as_deref(),
            None
        );
    }

    #[test]
    fn infers_xiaohongshu_extension_for_cdn_urls_without_suffix() {
        assert_eq!(
            preview_image_extension("", "https://sns-img-qc.xhscdn.com/notes_pre_post/abc123"),
            Some("jpg")
        );
        assert_eq!(
            preview_image_extension(
                "",
                "https://sns-img-qc.xhscdn.com/notes_pre_post/abc123?format=webp"
            ),
            Some("webp")
        );
    }

    #[test]
    fn reads_jpeg_preview_dimensions() {
        let bytes = [
            0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x07, 0x80, 0x04, 0x38, 0x03, 0x01, 0x11,
            0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
        ];

        assert_eq!(
            preview_image_dimensions("image/jpeg", &bytes),
            Some((1080, 1920))
        );
    }

    #[test]
    fn reads_png_preview_dimensions() {
        let bytes = [
            0x89, b'P', b'N', b'G', b'\r', b'\n', 0x1a, b'\n', 0x00, 0x00, 0x00, 0x0d, b'I', b'H',
            b'D', b'R', 0x00, 0x00, 0x04, 0x38, 0x00, 0x00, 0x07, 0x80,
        ];

        assert_eq!(
            preview_image_dimensions("image/png", &bytes),
            Some((1080, 1920))
        );
    }
}
