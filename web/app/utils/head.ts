import { useLocation } from "@solidjs/router";
import { useHead } from "@solidjs/web";

import { site } from "../../../site.config.ts";

export const SITE_NAME = "smails";
export const BASE_URL = `https://${site.domain}`;
const OG_IMAGE_URL = `${BASE_URL}/og.png`;

type HeadTag = Parameters<typeof useHead>[0] extends infer T
	? T extends { tag: string }
		? T
		: never
	: never;

function meta(
	attribute: "name" | "property",
	key: string,
	content: string,
): HeadTag {
	return { tag: "meta", key, props: { [attribute]: key, content } };
}

/** 每个页面调用一次：title、description、robots、canonical 和分享卡片。 */
export function usePageHead(page: {
	title: string;
	description: string;
	noindex?: boolean;
}): void {
	const location = useLocation();
	useHead(() => {
		const url = `${BASE_URL}${location.pathname === "/" ? "" : location.pathname}`;
		return [
			{ tag: "title", key: "title", props: { children: page.title } },
			meta("name", "description", page.description),
			meta(
				"name",
				"robots",
				page.noindex ? "noindex, nofollow" : "index, follow",
			),
			{ tag: "link", key: "canonical", props: { rel: "canonical", href: url } },
			meta("property", "og:type", "website"),
			meta("property", "og:site_name", SITE_NAME),
			meta("property", "og:url", url),
			meta("property", "og:title", page.title),
			meta("property", "og:description", page.description),
			meta("property", "og:image", OG_IMAGE_URL),
			meta("name", "twitter:card", "summary_large_image"),
			meta("name", "twitter:title", page.title),
			meta("name", "twitter:description", page.description),
			meta("name", "twitter:image", OG_IMAGE_URL),
		];
	});
}
