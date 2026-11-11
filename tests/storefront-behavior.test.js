import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");

async function registerComponents(file, environment = {}) {
	const source = await readFile(path.join(root, ...file.split("/")), "utf8");
	const script = source.match(/{% javascript %}([\s\S]*?){% endjavascript %}/)?.[1];
	assert.ok(script, "Expected native Shopify JavaScript block");
	const components = new Map();
	const context = {
		HTMLElement: class {},
		customElements: {
			get: (name) => components.get(name),
			define: (name, constructor) => components.set(name, constructor)
		},
		console,
		URL,
		AbortController,
		...environment
	};
	new vm.Script(script, { filename: file }).runInNewContext(context);
	return components;
}

describe("Shopify reference storefront behavior", () => {
	it("renders a selected product option via Section Rendering API and preserves quantity", async () => {
		let requestedUrl;
		let browserUrl;
		let replaced = false;
		let focused = false;
		const newQuantity = { value: "1" };
		const newPlan = { value: "" };
		const replacement = {
			querySelector: () => ({
				elements: {
					namedItem: (name) => (name === "quantity" ? newQuantity : name === "selling_plan" ? newPlan : null)
				}
			}),
			querySelectorAll: () => [
				{
					focus: () => {
						focused = true;
					}
				}
			]
		};
		const environment = {
			window: {
				location: { href: "https://example.com/products/test", origin: "https://example.com" },
				history: {
					state: {},
					replaceState: (_state, _title, url) => {
						browserUrl = url;
					}
				}
			},
			fetch: async (url) => {
				requestedUrl = new URL(url);
				return { ok: true, text: async () => "<section data-product-section></section>" };
			},
			DOMParser: class {
				parseFromString() {
					return { querySelector: () => replacement };
				}
			}
		};
		const components = await registerComponents("src/theme/blocks/product-purchase.liquid", environment);
		const productForm = new (components.get("product-form"))();
		const originalSection = {
			dataset: { sectionId: "template--1__main", productUrl: "/products/test" },
			replaceWith: (node) => {
				replaced = node === replacement;
			}
		};
		productForm.closest = () => originalSection;
		productForm.options = [{ value: "123", selectedOptions: [{ dataset: { productUrl: "" } }] }];
		productForm.appliedValues = ["100"];
		productForm.form = {
			elements: { namedItem: (name) => ({ quantity: { value: "3" }, selling_plan: { value: "plan-1" } })[name] }
		};
		productForm.submit = { disabled: false };
		productForm.canSubmit = true;
		productForm.status = { textContent: "" };
		productForm.isConnected = true;
		productForm.setAttribute = () => {};
		productForm.removeAttribute = () => {};

		await productForm.refreshProduct(0);

		assert.equal(requestedUrl.searchParams.get("option_values"), "123");
		assert.equal(requestedUrl.searchParams.get("section_id"), "template--1__main");
		assert.equal(newQuantity.value, "3");
		assert.equal(newPlan.value, "plan-1");
		assert.ok(replaced);
		assert.ok(focused);
		assert.equal(browserUrl.searchParams.get("option_values"), "123");
		assert.equal(browserUrl.searchParams.has("section_id"), false);
	});

	it("offers keyboard navigation in predictive search without removing input focus", async () => {
		let destination;
		const attributes = new Map([["aria-expanded", "true"]]);
		const options = [
			{ id: "PredictiveSearchOption-0", setAttribute: () => {}, querySelector: () => ({ href: "/products/one" }) },
			{ id: "PredictiveSearchOption-1", setAttribute: () => {}, querySelector: () => ({ href: "/products/two" }) }
		];
		const components = await registerComponents("src/theme/sections/search/main-search.liquid", {
			window: {
				location: {
					assign: (url) => {
						destination = url;
					}
				}
			}
		});
		const search = new (components.get("predictive-search"))();
		search.input = {
			getAttribute: (key) => attributes.get(key),
			setAttribute: (key, value) => attributes.set(key, value),
			removeAttribute: (key) => attributes.delete(key)
		};
		search.results = { querySelectorAll: () => options, replaceChildren: () => {} };
		search.activeIndex = -1;
		let prevented = 0;
		const event = (key) => ({
			key,
			preventDefault: () => {
				prevented += 1;
			}
		});

		search.onKeyDown(event("ArrowUp"));
		assert.equal(search.activeIndex, 1, "ArrowUp from no selection starts at the last suggestion");
		search.onKeyDown(event("ArrowDown"));
		assert.equal(search.activeIndex, 0);
		assert.equal(attributes.get("aria-activedescendant"), options[0].id);
		search.onKeyDown(event("ArrowUp"));
		assert.equal(search.activeIndex, 1);
		search.onKeyDown(event("Enter"));
		assert.equal(destination, "/products/two");
		const pending = new AbortController();
		search.controller = pending;
		search.onKeyDown(event("Escape"));
		assert.equal(pending.signal.aborted, true, "Escape must cancel an in-flight search");
		assert.equal(search.activeIndex, -1);
		assert.equal(attributes.get("aria-expanded"), "false");
		assert.equal(prevented, 5);
	});

	it("ships complete German translations matching the English reference keys", async () => {
		const localeDir = path.join(root, "src/theme/locales");
		const english = JSON.parse(await readFile(path.join(localeDir, "en.default.json"), "utf8"));
		const german = JSON.parse(await readFile(path.join(localeDir, "de.json"), "utf8"));
		const keys = (value, prefix = "") =>
			Object.entries(value).flatMap(([key, entry]) =>
				typeof entry === "object" ? keys(entry, prefix + key + ".") : [prefix + key]
			);
		assert.deepEqual(keys(german).sort(), keys(english).sort());
	});
});
