const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number) => n.toString().padStart(2, "0");

/**
 * 把时间戳（number，毫秒）或时间字符串格式化为确定性的「Jun 23, 09:42」。
 * 不依赖「现在」，因此预渲染（构建时）与客户端结果一致，避免 hydration 文本不匹配。
 */
export function formatTime(time: string | number): string {
  const d = new Date(time);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 取地址/名字首字母做头像占位 */
export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed[0].toUpperCase();
}
