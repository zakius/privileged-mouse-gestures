if (typeof JSWindowActorChild == 'undefined')
	(globalThis as any).JSWindowActorChild = class { }
if (typeof JSWindowActorParent == 'undefined')
	(globalThis as any).JSWindowActorParent = class { }

class PrivilegedScripts_privileged_mouse_gestures_qw_thucfb_comChild
	extends JSWindowActorChild {
	private readonly sandboxMap = new Map<string, any>()
	private readonly systemPrincipal: 'nsIPrincipal' =
		(Components as any).classes["@mozilla.org/systemprincipal;1"]
			.createInstance((Components as any).interfaces.nsIPrincipal)

	constructor() {
		super()
		let Services: any
		try {
			Services = ChromeUtils.import("resource://gre/modules/Services.jsm").Services
		} catch { Services = (globalThis as any).Services }
		Services.cpmm.addMessageListener('Extension:Shutdown',
			(message: ReceiveMessageArgument) => {
				const id = message.data.id
				const sandbox = this.sandboxMap.get(id)
				if (!sandbox) return
				Components.utils.nukeSandbox(sandbox)
				this.sandboxMap.delete(id)
			})
	}

	async receiveMessage(message: ReceiveMessageArgument) {
		if (message.name === 'executeScript') {
			if (!this.contentWindow) return undefined
			const { extensionId: id, code, url } = message.data

			let sandbox = this.sandboxMap.get(id)
			if (!sandbox) {
				sandbox = Components.utils.Sandbox(this.systemPrincipal, {
					sameZoneAs: this.contentWindow,
					sandboxName: `PrivilegedScripts_${id}`,
					sandboxPrototype: this.contentWindow,
					wantComponents: true,
					wantExportHelpers: true,
					wantXrays: true,
				})
				this.sandboxMap.set(id, sandbox)
			}

			try {
				let result: any
				if (code != null) {
					result = Components.utils.evalInSandbox(code, sandbox, 'true')
				} else if (url != null) {
					result = ChromeUtils.compileScript(url,
						{ hasReturnValue: true }).executeInGlobal(sandbox)
				}
				return { result: await result }
			} catch (error: any) {
				return { error: error.message }
			}
		}
		return undefined
	}
}

class PrivilegedScripts_privileged_mouse_gestures_qw_thucfb_comParent
	extends JSWindowActorParent { }

class privilegedScripts extends ExtensionAPI {
	private static actorName = 'PrivilegedScripts_privileged_mouse_gestures_qw_thucfb_com'
	private static refCount = 0

	private static writeFileIfNotExist(file: any, content: string) {
		if (file.exists()) return
		const stream = Components.classes["@mozilla.org/network/file-output-stream;1"]
			.createInstance(Components.interfaces.nsIFileOutputStream)
		stream.init(file, 0x02 | 0x08 | 0x20, 0o644, 0)
		stream.write(content, content.length)
		stream.close()
	}

	private static init(context: BaseContext) {
		let Services: any
		try {
			Services = ChromeUtils.import("resource://gre/modules/Services.jsm").Services
		} catch { Services = (globalThis as any).Services }

		const { interfaces: Ci } = Components
		const dir = Services.dirsvc.get("UChrm", Ci.nsIFile)
		dir.append(this.actorName)
		if (!dir.exists()) dir.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755)
		dir.append('v0')
		if (!dir.exists()) dir.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755)

		let file = dir.clone()
		file.append('chrome.manifest')
		this.writeFileIfNotExist(file, `content ${this.actorName} ../\n`)
		Components.manager.QueryInterface(Ci.nsIComponentRegistrar).autoRegister(file)

		file = dir.clone()
		file.append('privileged-scripts-child.js')
		this.writeFileIfNotExist(file,
			`${PrivilegedScripts_privileged_mouse_gestures_qw_thucfb_comChild}
			export { ${PrivilegedScripts_privileged_mouse_gestures_qw_thucfb_comChild.name} }`)
		file = dir.clone()
		file.append('privileged-scripts-parent.js')
		this.writeFileIfNotExist(file,
			`${PrivilegedScripts_privileged_mouse_gestures_qw_thucfb_comParent}
			export { ${PrivilegedScripts_privileged_mouse_gestures_qw_thucfb_comParent.name} }`)

		const rand = `${Date.now()}_${Math.random()}`
		ChromeUtils.registerWindowActor(this.actorName, {
			allFrames: true,
			includeChrome: true,
			parent: {
				esModuleURI: `chrome://${this.actorName}/content/v0/privileged-scripts-parent.js?rand=${rand}`,
			},
			child: {
				esModuleURI: `chrome://${this.actorName}/content/v0/privileged-scripts-child.js?rand=${rand}`,
			},
			safeForUntrustedWebProcess: true,
		})
		privilegedScripts.refCount++
	}

	static close() {
		if (--privilegedScripts.refCount) return
		ChromeUtils.unregisterWindowActor(this.actorName)
	}

	getAPIImpl = (_that: this, context: BaseContext) => ({
		_init: (() => {
			privilegedScripts.init(context)
			context.extension.callOnClose(privilegedScripts)
		})(),

		async executeScript({
			tabId = -1, allFrames = false,
			code = undefined as string | undefined,
			file = undefined as string | undefined,
		}) {
			const { extension } = context
			const { tabManager } = extension
			const rootBC = tabManager.get(tabId).browser.browsingContext

			const promises: Promise<{ result?: any; error?: any }>[] = []
			function executeOnContext(bc: typeof rootBC) {
				const global = bc.currentWindowGlobal
				if (!global) return
				const actor = global.getActor(privilegedScripts.actorName)
				promises.push(actor.sendQuery("executeScript", {
					extensionId: extension.id,
					code,
					url: file !== undefined ? extension.getURL(file) : undefined
				}))
				if (allFrames) [...bc.getChildren()].forEach(executeOnContext)
			}
			executeOnContext(rootBC)
			return (await Promise.all(promises)).map(v => {
				if (v && v.error) throw { message: v.error }
				return v && v.result
			})
		}
	})

	getAPI(context: BaseContext) {
		return { [this.constructor.name]: this.getAPIImpl(this, context) }
	}
}
Object.assign(globalThis, { privilegedScripts })
type privilegedScriptsAPI = ReturnType<typeof privilegedScripts.prototype.getAPIImpl>
declare namespace browser { const privilegedScripts: privilegedScriptsAPI }
