//#region src/lib/compare.ts
function isEqual(a, b) {
	return a === b;
}
function compareArrays(a, b, eq) {
	return a === b || a.length === b.length && a.every((value, index) => eq(value, b[index]));
}
function compareQuery(a, b) {
	if (a === b) return true;
	if (a === null || b === null) return false;
	if (typeof a === "string" || typeof b === "string") return false;
	if (a.length !== b.length) return false;
	return a.every((value, index) => value === b[index]);
}
//#endregion
export { compareQuery as n, isEqual as r, compareArrays as t };

//# sourceMappingURL=compare-DUeKXGOW.js.map