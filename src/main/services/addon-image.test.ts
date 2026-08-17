import { describe, expect, it } from "vitest"
import { addonImageCandidates } from "./addon-image"

describe("Addon image", () => {
	it("looks for images with the VPK basename", () => {
		expect(addonImageCandidates("C:\\addons\\workshop\\123.vpk")).toEqual([
			"C:\\addons\\workshop\\123.jpg",
			"C:\\addons\\workshop\\123.jpeg",
			"C:\\addons\\workshop\\123.png",
			"C:\\addons\\workshop\\123.webp",
			"C:\\addons\\workshop\\123.gif",
			"C:\\addons\\workshop\\123.bmp"
		])
	})
})
