import { BuiltinCommandKey, CommandKey } from '../common/settings.js'
import { mapInsert } from '../util/util.js'
import { M } from '../util/webext/i18n.js'

type SectionKey = keyof I18nMessages
type CommandFunction = (windowId: number) => void

function tabCommand(next: (tab: browser.tabs.Tab, windowId: number) => void) {
	return async (windowId: number) => {
		const tabs = await browser.tabs.query({ active: true, windowId })
		if (tabs.length) next(tabs[0], windowId)
	}
}

function docShellCommand(cmd: string) {
	return tabCommand((tab) => {
		browser.privilegedScripts.executeScript({
			tabId: tab.id,
			code: `window.docShell.doCommand(${JSON.stringify(cmd)})`,
		})
	})
}

/** Commands browser.browserCommands.getAll() cannot offer on its own, as
 * `[id, name, implementation?]`.
 *
 * Without an implementation the entry is a Firefox command that no labelled
 * element references, so there is no name to read off it -- about:keyboard has
 * the same problem and ships its own strings (customkeys-nav-back and friends).
 * The rest are actions Firefox has no command for at all. */
const commandList: [
	SectionKey,
	[CommandKey, BuiltinCommandKey, CommandFunction?][],
][] = [
	[
		'tab',
		[
			['Browser:PrevTab', 'previousTab'],
			['Browser:NextTab', 'nextTab'],
			['Browser:DuplicateTab', 'duplicateTab'],
			[
				// Firefox's own cmd_close closes pinned tabs too.
				'closeTab',
				'closeTab',
				tabCommand((tab) => {
					if (!tab.pinned) browser.tabs.remove(tab.id!)
				}),
			],
		],
	],
	[
		'navigation',
		[
			[
				'upperLevel',
				'upperLevel',
				tabCommand((tab) => {
					let url = new URL(tab.url!)
					if (!url.pathname || url.pathname === '/') {
						if (!url.hostname.includes('.')) return
						url.hostname = url.hostname.replace(/^[^.]*\./, '')
					} else {
						url = new URL(url.pathname.endsWith('/') ? '..' : './', url)
					}
					browser.tabs.update(tab.id!, { url: url.href })
				}),
			],
		],
	],
	[
		'page',
		[
			// Scrolling exists only as a docShell command.
			['scrollUp', 'scrollUp', docShellCommand('cmd_scrollPageUp')],
			['scrollDown', 'scrollDown', docShellCommand('cmd_scrollPageDown')],
			['scrollToTop', 'scrollToTop', docShellCommand('cmd_scrollTop')],
			['scrollToBottom', 'scrollToBottom', docShellCommand('cmd_scrollBottom')],
		],
	],
]
const commandMap = new Map<CommandKey, CommandFunction>(
	commandList.flatMap(([_, items]) =>
		items.flatMap(([id, , fn]) => (fn ? [[id, fn] as const] : [])),
	),
)

interface CommandSection {
	category: string
	items: { id: CommandKey; label: string }[]
}

/** The commands above, then everything the browser and the installed extensions
 * expose, grouped by the category each reports. */
export async function getCommandList(): Promise<CommandSection[]> {
	// Keyed by name so the sections above merge with the browser's own: both
	// call the same category "Navigation".
	const sections = new Map<string, CommandSection['items']>()
	for (const [section, items] of commandList)
		mapInsert(sections, M[section], () => []).push(
			...items.map(([id, name]) => ({ id, label: M[name] })),
		)
	for (const { id, label, category } of await browser.browserCommands.getAll())
		mapInsert(sections, category ?? M.otherCommands, () => []).push({
			id,
			label,
		})
	return [...sections].map(([category, items]) => ({ category, items }))
}

export function getCommandFunction(key: CommandKey): CommandFunction {
	return (
		commandMap.get(key) ??
		((windowId) => {
			void browser.browserCommands.run(key, windowId)
		})
	)
}
