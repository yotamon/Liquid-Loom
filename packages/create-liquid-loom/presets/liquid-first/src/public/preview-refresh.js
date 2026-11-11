// Shopify provides this module through its preview storefront import map.
// It is not a public npm dependency. This code is excluded from stable projects.
import { partials } from "@shopify/partial-rendering";

const refreshButton = document.querySelector("[data-preview-refresh]");
if (refreshButton) {
	let inFlight = false;
	refreshButton.addEventListener("click", async () => {
		if (inFlight) return;
		inFlight = true;
		refreshButton.disabled = true;
		const status = document.querySelector("[data-preview-status]");
		const scope = refreshButton.closest(".content-stack");
		if (scope) scope.setAttribute("aria-busy", "true");
		if (status) status.textContent = "";
		try {
			await partials.refresh("preview-time");
			if (status) status.textContent = refreshButton.dataset.success;
		} catch (error) {
			console.error("Shopify preview partial refresh failed", error);
			if (status) status.textContent = refreshButton.dataset.failure;
		} finally {
			inFlight = false;
			refreshButton.disabled = false;
			if (scope) scope.removeAttribute("aria-busy");
		}
	});
}
