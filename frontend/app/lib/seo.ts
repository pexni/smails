import type { MetaDescriptor } from "react-router";

const OG_IMAGE = "https://smails.dev/og.png";

/** The shared title/OpenGraph/Twitter meta tags for a content page. */
export function pageMeta({
  url,
  title,
  description,
  imageAlt,
}: {
  url: string;
  title: string;
  description: string;
  imageAlt: string;
}): MetaDescriptor[] {
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "article" },
    { property: "og:url", content: url },
    { property: "og:site_name", content: "smails" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: OG_IMAGE },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: imageAlt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: OG_IMAGE },
  ];
}

export interface FaqItem {
  q: string;
  a: string;
}

// schema.org JSON-LD @graph node builders, shared by the content pages.
export function breadcrumbList(name: string, url: string) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "smails", item: "https://smails.dev/" },
      { "@type": "ListItem", position: 2, name, item: url },
    ],
  };
}

export function faqPage(items: FaqItem[]) {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
