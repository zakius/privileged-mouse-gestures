export function mapInsert<K, V>(
	map: Map<K, V> | (K extends object ? WeakMap<K, V> : never),
	key: K,
	fn: () => V,
) {
	if (map.has(key)) return map.get(key)!
	const value = fn()
	map.set(key, value)
	return value
}
