var {
	ExtensionParent: { apiManager: extensionAPIManager },
} = ChromeUtils.importESModule('resource://gre/modules/ExtensionParent.sys.mjs')

const ADDON_COMMAND_PREFIX = 'addon:'

// Firefox has no registry of invokable commands. about:keyboard builds its own
// list by walking the menu bar and hardcoding the rest (CustomKeysParent.getKeys);
// this keys off <command> elements instead, which cover every menu bar action
// plus the ones that never appear in a menu, and borrows labels from whichever
// element references each command -- Fluent has already localized those by the
// time we read them.
class browserCommands extends ExtensionAPI {
	private static collectChromeCommands(wnd: Window) {
		// A command is referenced from several places; the menu bar copy is the
		// one worth having, because it carries a label and, through its ancestor
		// <menu>, the category the command is filed under. Context menus come
		// first in DOM order, so without ranking, Cut/Copy/Paste get attributed
		// to the page context menu instead of Edit.
		const rank = (el: Element) =>
			(el.closest('#main-menubar') ? 2 : 0) +
			(el.localName === 'menuitem' ? 1 : 0)

		const referrers = new Map<string, Element>()
		for (const el of wnd.document.querySelectorAll('[command]')) {
			if (!(el as any).label) continue
			const id = el.getAttribute('command')!
			const previous = referrers.get(id)
			if (previous && rank(previous) >= rank(el)) continue
			referrers.set(id, el)
		}

		const result = []
		for (const { id } of wnd.document.querySelectorAll('command[id]')) {
			const referrer = referrers.get(id)
			// No label means no way to present it in a list: downloads panel
			// commands, touch gesture internals and similar.
			if (!referrer) continue
			result.push({
				id,
				label: (referrer as any).label as string,
				category: (referrer.closest('menu') as any)?.label ?? null,
			})
		}
		return result
	}

	private static async collectAddonCommands() {
		const result = []
		for (const policy of WebExtensionPolicy.getActiveExtensions()) {
			const shortcuts = policy.extension?.shortcuts
			if (!shortcuts) continue
			for (const { name, description } of await shortcuts.allCommands())
				result.push({
					id: `${ADDON_COMMAND_PREFIX}${policy.id}/${name}`,
					label: description || name,
					category: policy.name,
				})
		}
		return result
	}

	// Mirrors the listener ExtensionShortcuts.buildKey attaches to the <key>
	// element it creates, so a command behaves identically whether it is reached
	// by gesture or by its keyboard shortcut. Reusing that key element instead is
	// not an option: Firefox only builds one for commands that have a shortcut.
	private static runAddonCommand(qualifiedName: string, wnd: Window) {
		const separator = qualifiedName.indexOf('/')
		const policy = WebExtensionPolicy.getByID(qualifiedName.slice(0, separator))
		const name = qualifiedName.slice(separator + 1)
		const extension = policy?.extension
		if (!extension?.shortcuts) return

		const { global } = extensionAPIManager
		const actionFor = {
			[extension.manifestVersion < 3
				? '_execute_browser_action'
				: '_execute_action']: global.browserActionFor,
			_execute_page_action: global.pageActionFor,
			_execute_sidebar_action: global.sidebarActionFor,
		}[name]
		if (actionFor) actionFor(extension)?.triggerAction(wnd)
		else extension.shortcuts.onCommand(name)
	}

	getAPIImpl = (context: BaseContext) => {
		// The options page has no window of its own to ask about.
		const getWindow = (windowId?: number) =>
			windowId == null
				? extensionAPIManager.global.windowTracker.topWindow
				: context.extension.windowManager.get(windowId, context).window

		return {
			async getAll(windowId?: number) {
				const wnd = getWindow(windowId)
				return [
					...(wnd ? browserCommands.collectChromeCommands(wnd) : []),
					...(await browserCommands.collectAddonCommands()),
				]
			},

			async run(id: string, windowId?: number) {
				const wnd = getWindow(windowId)
				if (!wnd) return
				if (id.startsWith(ADDON_COMMAND_PREFIX)) {
					browserCommands.runAddonCommand(
						id.slice(ADDON_COMMAND_PREFIX.length),
						wnd,
					)
					return
				}
				// doCommand() dispatches the same `command` event a menu click
				// does, entering through the delegated listener in browser-sets.js
				// rather than around it.
				;(wnd.document.getElementById(id) as any)?.doCommand()
			},
		}
	}

	getAPI(context: BaseContext) {
		return { [this.constructor.name]: this.getAPIImpl(context) }
	}
}
Object.assign(globalThis, { browserCommands })
type browserCommandsAPI = ReturnType<
	typeof browserCommands.prototype.getAPIImpl
>
declare namespace browser {
	// oxlint-disable-next-line no-unused-vars -- ambient API declaration
	const browserCommands: browserCommandsAPI
}
declare namespace browser.browserCommands {
	interface CommandInfo {
		id: string
		label: string
		category: string | null
	}
}
