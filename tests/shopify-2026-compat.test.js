import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => readFile(path.join(root, file), "utf8");
const mirrored = (file) =>
	Promise.all([read("src/theme/" + file), read("packages/create-liquid-loom/template/src/theme/" + file)]);

describe("Shopify November 2026 storefront compatibility", () => {
	it("uses locale direction and translated footer fallbacks in the shipped starter", async () => {
		const [layout, starterLayout] = await mirrored("layout/theme.liquid");
		assert.equal(layout, starterLayout);
		assert.match(layout, /request\.locale\.direction\s*\|\s*default:\s*'ltr'/);
		const [footer, starterFooter] = await mirrored("sections/global/footer.liquid");
		assert.equal(footer, starterFooter);
		assert.match(footer, /'footer\.explore'\s*\|\s*t/);
		assert.match(footer, /'footer\.information'\s*\|\s*t/);
		for (const name of ["en.default", "de"]) {
			const [source, starter] = await mirrored("locales/" + name + ".json");
			assert.equal(source, starter);
			const locales = JSON.parse(source);
			assert.ok(locales.footer.explore && locales.footer.information);
		}
	});

	it("ships a merchant-editable, structured product disclosures section", async () => {
		const [source, starter] = await mirrored("sections/products/product-disclosures.liquid");
		assert.equal(source, starter);
		assert.match(source, /product\.metafields\.shopify\.disclosure\.value/);
		assert.match(source, /disclosure\.content\s*\|\s*metafield_tag/);
		assert.match(source, /<details/);
		const schema = JSON.parse(source.split("{% schema %}")[1].split("{% endschema %}")[0]);
		assert.equal(schema.limit, 1);
		assert.ok(schema.settings.find((setting) => setting.id === "open_by_default"));
		const [template, starterTemplate] = await mirrored("templates/product.json");
		assert.equal(template, starterTemplate);
		const parsed = JSON.parse(template);
		assert.equal(parsed.sections.disclosures.type, "product-disclosures");
		assert.equal(parsed.order.at(-1), "disclosures");
	});

	it("updates cart count from successful standard action events, not rejected or stale results", async () => {
		const [header, starter] = await mirrored("sections/global/header.liquid");
		assert.equal(header, starter);
		const script = header.split("{% javascript %}")[1].split("{% endjavascript %}")[0];
		const listeners = {};
		const nodes = [{ textContent: "1" }, { textContent: "1" }];
		const document = {
			addEventListener: (event, listener) => {
				listeners[event] = listener;
			},
			querySelectorAll: () => nodes
		};
		vm.runInNewContext(script, {
			HTMLElement: class {},
			customElements: { get: () => true },
			document,
			Promise,
			Number,
			String
		});
		assert.equal(typeof listeners["shopify:cart:lines-update"], "function");
		let finishOld;
		const old = new Promise((resolve) => {
			finishOld = resolve;
		});
		listeners["shopify:cart:lines-update"]({ promise: old });
		listeners["shopify:cart:lines-update"]({ promise: Promise.resolve({ cart: { totalQuantity: 4 } }) });
		await Promise.resolve();
		await Promise.resolve();
		finishOld({ cart: { totalQuantity: 2 } });
		await Promise.resolve();
		await Promise.resolve();
		assert.deepEqual(
			nodes.map((node) => node.textContent),
			["4", "4"]
		);
		listeners["shopify:cart:lines-update"]({
			promise: Promise.resolve({ cart: { totalQuantity: 99 }, userErrors: [{ message: "Invalid" }] })
		});
		await Promise.resolve();
		await Promise.resolve();
		assert.equal(nodes[0].textContent, "4");
		listeners["shopify:cart:lines-update"]({ promise: Promise.reject(new Error("aborted")) });
		await Promise.resolve();
		await Promise.resolve();
		assert.equal(nodes[0].textContent, "4");
		let finishEarlier;
		listeners["shopify:cart:lines-update"]({
			promise: new Promise((resolve) => {
				finishEarlier = resolve;
			})
		});
		listeners["shopify:cart:lines-update"]({ promise: Promise.reject(new Error("later mutation failed")) });
		await Promise.resolve();
		await Promise.resolve();
		finishEarlier({ cart: { totalQuantity: 5 } });
		await Promise.resolve();
		await Promise.resolve();
		assert.equal(nodes[0].textContent, "5", "an earlier successful mutation still counts when a later one fails");
	});
});
