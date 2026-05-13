const path = require("node:path");
const CopyPlugin = require("copy-webpack-plugin");
const { ExtReloader } = require("webpack-ext-reloader-next");

/** @type {import('webpack').Configuration} */
module.exports = {
	mode: "development",
	devtool: "cheap-module-source-map",
	context: __dirname,
	entry: {
		background: "./src/background.ts",
		content: "./src/content.ts",
		popup: "./src/popup.ts",
	},
	output: {
		path: path.resolve(__dirname, "dist"),
		filename: "[name].js",
		clean: true,
	},
	resolve: {
		extensions: [".ts", ".js"],
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				use: "ts-loader",
				exclude: /node_modules/,
			},
		],
	},
	plugins: [
		new CopyPlugin({
			patterns: [
				{ from: "src/manifest.json", to: "manifest.json" },
				{ from: "src/popup.html", to: "popup.html" },
			],
		}),
		new ExtReloader(),
	],
	performance: {
		hints: false,
	},
};
