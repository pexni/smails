import { defineConfig } from "tsdown";

export default defineConfig({
	entry: { index: "src/index.ts" },
	format: "esm",
	platform: "node",
	target: "node22",
	// 发布的是一个可执行文件，不需要类型声明。
	dts: false,
	// 输出 dist/index.js（package.json 的 bin 指向它）。
	fixedExtension: false,
	clean: true,
});
