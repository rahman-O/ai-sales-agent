/** Rough chunker shared with API knowledge service (~500 tokens / ~75 overlap). */
export function chunkText(text) {
    const cleaned = text.replace(/\r\n/g, '\n').trim();
    if (!cleaned)
        return [];
    const target = 2000;
    const overlap = 300;
    if (cleaned.length <= target)
        return [cleaned];
    const chunks = [];
    let i = 0;
    while (i < cleaned.length) {
        const end = Math.min(cleaned.length, i + target);
        let slice = cleaned.slice(i, end);
        if (end < cleaned.length) {
            const lastBreak = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('. '));
            if (lastBreak > target * 0.4)
                slice = slice.slice(0, lastBreak + 1);
        }
        chunks.push(slice.trim());
        if (i + slice.length >= cleaned.length)
            break;
        i = Math.max(i + slice.length - overlap, i + 1);
    }
    return chunks.filter(Boolean);
}
