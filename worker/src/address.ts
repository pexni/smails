import { hmac } from "./crypto.ts";

// 地址：<形容词>-<名词>-<4 位随机><4 位校验码>，例如 brave-otter-k3j9x2m8。
// 校验码 = HMAC(ADDR_SECRET, 前面那部分) 的前 4 位 base36。收信时先验它：
// 不是我们发出去的地址（垃圾邮件、乱填的地址）直接丢弃，不写任何东西。

// prettier-ignore
const ADJECTIVES = [
	"able", "amber", "ample", "azure", "bold", "brave", "breezy", "bright",
	"brisk", "calm", "candid", "cheery", "civic", "clear", "clever", "cool",
	"cosmic", "cozy", "crisp", "curious", "daring", "dawn", "deft", "eager",
	"early", "easy", "epic", "even", "fair", "fancy", "fast", "fierce",
	"fine", "firm", "fleet", "fond", "fresh", "frosty", "gentle", "giant",
	"glad", "golden", "grand", "great", "green", "happy", "hardy", "hazel",
	"honest", "humble", "ideal", "indigo", "jolly", "keen", "kind", "lively",
	"lucky", "lunar", "magic", "mellow", "merry", "mighty", "misty", "modest",
	"neat", "nimble", "noble", "novel", "olive", "open", "patient", "plucky",
	"polite", "prime", "proud", "quick", "quiet", "rapid", "ready", "regal",
	"rosy", "royal", "rustic", "sage", "silent", "silver", "simple", "sleek",
	"smart", "snowy", "solar", "solid", "sonic", "spry", "steady", "stellar",
	"sturdy", "sunny", "super", "swift", "tidy", "tranquil", "true", "trusty",
	"upbeat", "urban", "valiant", "vivid", "warm", "wavy", "wise", "witty",
	"zany", "zen", "zesty", "agile", "alert", "bouncy", "chill", "dandy",
];

// prettier-ignore
const NOUNS = [
	"acorn", "alpaca", "anchor", "apple", "arrow", "aspen", "badger", "bamboo",
	"beacon", "beaver", "birch", "bison", "breeze", "brook", "cactus", "canyon",
	"cedar", "cloud", "comet", "coral", "cosmos", "crane", "creek", "daisy",
	"delta", "dolphin", "dune", "eagle", "ember", "falcon", "fern", "finch",
	"fjord", "forest", "fox", "galaxy", "gazelle", "geyser", "glacier", "grove",
	"harbor", "hawk", "heron", "hill", "island", "ivy", "jaguar", "koala",
	"lagoon", "lake", "lark", "lemur", "lily", "lotus", "lynx", "maple",
	"meadow", "mesa", "meteor", "moose", "moss", "nebula", "oasis", "ocean",
	"orbit", "orca", "otter", "owl", "panda", "pebble", "pine", "planet",
	"plume", "pond", "prairie", "puffin", "quail", "quartz", "rabbit", "raven",
	"reef", "ridge", "river", "robin", "rocket", "sable", "salmon", "sequoia",
	"shore", "sparrow", "spruce", "star", "stone", "summit", "swan", "thistle",
	"thunder", "tiger", "trail", "tulip", "tundra", "valley", "violet", "walrus",
	"willow", "wolf", "wren", "yak", "zebra", "zephyr", "basil", "clover",
	"dingo", "egret", "gecko", "iris", "kiwi", "magpie", "newt", "poppy",
];

const BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz";
const LOCAL_PART = /^([a-z]+-[a-z]+-[0-9a-z]{4})([0-9a-z]{4})$/;

function pick<T>(list: readonly T[], value: number): T {
	return list.at(value % list.length)!;
}

function randomBase36(length: number): string {
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return [...bytes].map((byte) => BASE36.charAt(byte % 36)).join("");
}

async function checksum(secret: string, stem: string): Promise<string> {
	const digest = await hmac(secret, `addr:${stem}`);
	let tag = "";
	for (let index = 0; index < 4; index++) {
		tag += BASE36.charAt((digest[index] ?? 0) % 36);
	}
	return tag;
}

/** 新地址的本地部分（@ 前面）。 */
export async function generateLocalPart(secret: string): Promise<string> {
	const [a = 0, b = 0] = crypto.getRandomValues(new Uint16Array(2));
	const stem = `${pick(ADJECTIVES, a)}-${pick(NOUNS, b)}-${randomBase36(4)}`;
	return `${stem}${await checksum(secret, stem)}`;
}

/**
 * 地址统一成一种写法：本地部分小写，去掉 `+` 后面的部分（`brave-otter-k3j9x2m8+github` 和
 * 本身是同一个收件箱，agent 可以用它区分来源）。域名不参与：几个收件域名共用同一批邮箱。
 */
export function normalizeLocalPart(address: string): string {
	const local = address.trim().toLowerCase().split("@")[0] ?? "";
	return local.split("+")[0] ?? "";
}

/** 校验码对不上（或者格式就不对）的地址不是我们发出去的。 */
export async function isIssuedLocalPart(
	secret: string,
	local: string,
): Promise<boolean> {
	const match = LOCAL_PART.exec(local);
	if (!match) {
		return false;
	}
	return (await checksum(secret, match[1]!)) === match[2];
}
