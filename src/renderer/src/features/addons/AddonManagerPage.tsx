import { useCallback, useEffect, useMemo, useState } from "react"
import type {
	AddonGroup,
	AddonOperationProgress,
	AddonRecord,
	AddonSnapshot,
	AddonUpdate
} from "../../../../shared/addon-types"
import {
	WinAppBarButton,
	WinButton,
	WinComboBox,
	WinCommandBar,
	WinContentDialog,
	WinInfoBar,
	WinListView,
	WinNumberBox,
	WinTextBox,
	WinTitleBar,
	WinToggleSwitch,
	WinTreeView
} from "../../components"
import type { WinItem } from "../../components"
import {
	buildGroupTree,
	filterAndSortAddons,
	findGroupTreeItem,
	formatDate,
	formatFileSize
} from "./addon-view"
import styles from "./AddonManagerPage.module.css"

type Notice = {
	severity: "Informational" | "Success" | "Warning" | "Error"
	title: string
	message: string
}

const sourceOptions = [
	{ label: "全部来源", value: "all" },
	{ label: "本地", value: "local" },
	{ label: "Workshop", value: "workshop" }
]

const enabledOptions = [
	{ label: "全部状态", value: "all" },
	{ label: "已启用", value: "enabled" },
	{ label: "已禁用", value: "disabled" },
	{ label: "未登记", value: "unlisted" }
]

const problemOptions = [
	{ label: "全部健康状态", value: "all" },
	{ label: "存在问题", value: "problems" },
	{ label: "状态正常", value: "healthy" }
]

const sortOptions = [
	{ label: "优先级", value: "priority" },
	{ label: "名称", value: "name" },
	{ label: "更新时间", value: "modifiedAt" },
	{ label: "保存顺序", value: "order" }
]

function sourceName(addon: AddonRecord): string {
	return addon.source === "workshop" ? "Workshop" : "本地"
}

function enabledName(addon: AddonRecord): string {
	if (addon.enabled === "unlisted") return "未登记"
	return addon.enabled ? "已启用" : "已禁用"
}

function parseTags(value: string): string[] {
	return [
		...new Set(
			value
				.split(/[,，]/)
				.map((tag) => tag.trim())
				.filter(Boolean)
		)
	]
}

function AddonThumbnail({ addon }: { addon: AddonRecord }): React.JSX.Element {
	const shouldLoad = addon.source === "workshop" && !addon.missing
	const [imageUrl, setImageUrl] = useState<string | null>(null)
	const [imageLoaded, setImageLoaded] = useState(false)
	const [loading, setLoading] = useState(shouldLoad)

	useEffect(() => {
		let active = true

		if (!shouldLoad) {
			return () => {
				active = false
			}
		}

		void window.api.addons
			.getAddonImage(addon.id)
			.then((url) => {
				if (!active) return
				setImageUrl(url)
				setLoading(false)
			})
			.catch(() => {
				if (active) setLoading(false)
			})

		return () => {
			active = false
		}
	}, [addon.id, shouldLoad])

	return (
		<div
			className={styles.addonThumbnail}
			data-loaded={String(imageLoaded)}
			data-loading={String(loading)}
			aria-hidden="true"
		>
			{imageUrl && (
				<img
					alt=""
					loading="lazy"
					src={imageUrl}
					onError={() => {
						setImageUrl(null)
						setImageLoaded(false)
					}}
					onLoad={() => setImageLoaded(true)}
				/>
			)}
			<span className={styles.addonPlaceholder}>VPK</span>
		</div>
	)
}

function AddonRow({ addon }: { addon: AddonRecord }): React.JSX.Element {
	return (
		<div className={styles.addonRow}>
			<div className={styles.addonState} data-enabled={String(addon.enabled)} />
			<AddonThumbnail key={addon.id} addon={addon} />
			<div className={styles.addonMain}>
				<div className={styles.addonTitleLine}>
					<strong>{addon.name}</strong>
					<span className={styles.sourceBadge} data-source={addon.source}>
						{sourceName(addon)}
					</span>
					{addon.issues.length > 0 && (
						<span className={styles.issueBadge}>{addon.issues.length} 个问题</span>
					)}
				</div>
				<div className={styles.addonPath}>{addon.relativePath}</div>
				<div className={styles.tagLine}>
					<span>{enabledName(addon)}</span>
					<span>优先级 {addon.priority}</span>
					{addon.tags.slice(0, 3).map((tag) => (
						<span className={styles.tag} key={tag}>
							{tag}
						</span>
					))}
				</div>
			</div>
		</div>
	)
}

function EmptyDetails(): React.JSX.Element {
	return (
		<div className={styles.emptyDetails}>
			<div className={styles.emptyGlyph}></div>
			<h2>选择 Addon</h2>
			<p>在左侧选择一个或多个 Addon 后，可以修改启用状态、分组、标签和优先级。</p>
		</div>
	)
}

interface SingleDetailsProps {
	addon: AddonRecord
	groups: AddonGroup[]
	busy: boolean
	onEnabled: (enabled: boolean) => Promise<void>
	onSave: (update: AddonUpdate) => Promise<void>
}

function SingleDetails({
	addon,
	groups,
	busy,
	onEnabled,
	onSave
}: SingleDetailsProps): React.JSX.Element {
	const [name, setName] = useState(addon.name)
	const [tags, setTags] = useState(addon.tags.join(", "))
	const [priority, setPriority] = useState(addon.priority)
	const [groupId, setGroupId] = useState(addon.groupId ?? "")
	const groupOptions = [
		{ label: "未分组", value: "" },
		...groups.map((group) => ({ label: group.name, value: group.id }))
	]

	return (
		<div className={styles.detailsContent}>
			<div className={styles.detailsHeading}>
				<div>
					<div className={styles.eyebrow}>{sourceName(addon)} ADDON</div>
					<h1>{addon.name}</h1>
				</div>
				<WinToggleSwitch
					IsOn={addon.enabled === true}
					IsEnabled={!busy && !addon.missing}
					OnContent="已启用"
					OffContent={addon.enabled === "unlisted" ? "未登记" : "已禁用"}
					onUpdate:IsOn={(value: boolean) => void onEnabled(value)}
				/>
			</div>

			<section className={styles.detailSection}>
				<h2>基本信息</h2>
				<label>
					<span>显示名称</span>
					<WinTextBox Value={name} onUpdate:Value={setName} IsEnabled={!busy} />
				</label>
				<label>
					<span>标签（用逗号分隔）</span>
					<WinTextBox Value={tags} onUpdate:Value={setTags} IsEnabled={!busy} />
				</label>
				<div className={styles.twoColumns}>
					<label>
						<span>优先级</span>
						<WinNumberBox
							Value={priority}
							Minimum={-9999}
							Maximum={9999}
							SpinButtonPlacementMode="Compact"
							IsEnabled={!busy}
							onUpdate:Value={setPriority}
						/>
					</label>
					<label>
						<span>虚拟分组</span>
						<WinComboBox
							ItemsSource={groupOptions}
							DisplayMemberPath="label"
							SelectedValuePath="value"
							SelectedValue={groupId}
							IsEnabled={!busy}
							onUpdate:SelectedValue={(value) => setGroupId(String(value ?? ""))}
						/>
					</label>
				</div>
				<WinButton
					Style="AccentButtonStyle"
					IsEnabled={!busy}
					onClick={() =>
						void onSave({
							name: name.trim() || addon.name,
							tags: parseTags(tags),
							priority,
							groupId: groupId || null
						})
					}
				>
					保存详细信息
				</WinButton>
			</section>

			<section className={styles.detailSection}>
				<h2>文件</h2>
				<dl className={styles.propertyList}>
					<div>
						<dt>路径</dt>
						<dd title={addon.filePath}>{addon.filePath}</dd>
					</div>
					<div>
						<dt>大小</dt>
						<dd>{formatFileSize(addon.size)}</dd>
					</div>
					<div>
						<dt>更新时间</dt>
						<dd>{formatDate(addon.modifiedAt)}</dd>
					</div>
					<div>
						<dt>加载顺序</dt>
						<dd>{addon.order}</dd>
					</div>
				</dl>
			</section>

			<section className={styles.detailSection}>
				<h2>依赖和冲突</h2>
				<p className={styles.muted}>尚未检测。第一版只检查文件和 addonlist.txt 状态。</p>
				{addon.issues.length > 0 ? (
					<ul className={styles.issueList}>
						{addon.issues.map((issue) => (
							<li key={issue}>{issue}</li>
						))}
					</ul>
				) : (
					<p className={styles.healthy}>当前未发现问题</p>
				)}
			</section>
		</div>
	)
}

interface MultiDetailsProps {
	addons: AddonRecord[]
	groups: AddonGroup[]
	busy: boolean
	onEnabled: (enabled: boolean) => Promise<void>
	onUpdate: (update: AddonUpdate) => Promise<void>
}

function MultiDetails({
	addons,
	groups,
	busy,
	onEnabled,
	onUpdate
}: MultiDetailsProps): React.JSX.Element {
	const [priority, setPriority] = useState(0)
	const [groupId, setGroupId] = useState("")
	const commonTags = addons
		.map((addon) => addon.tags)
		.reduce((common, tags) => common.filter((tag) => tags.includes(tag)))
	const groupOptions = [
		{ label: "未分组", value: "" },
		...groups.map((group) => ({ label: group.name, value: group.id }))
	]

	return (
		<div className={styles.detailsContent}>
			<div className={styles.detailsHeading}>
				<div>
					<div className={styles.eyebrow}>批量编辑</div>
					<h1>已选择 {addons.length} 个 Addon</h1>
				</div>
			</div>
			<section className={styles.detailSection}>
				<h2>启用状态</h2>
				<div className={styles.buttonRow}>
					<WinButton IsEnabled={!busy} onClick={() => void onEnabled(true)}>
						全部启用
					</WinButton>
					<WinButton IsEnabled={!busy} onClick={() => void onEnabled(false)}>
						全部禁用
					</WinButton>
				</div>
			</section>
			<section className={styles.detailSection}>
				<h2>共同标签</h2>
				<div className={styles.tagLine}>
					{commonTags.length > 0 ? (
						commonTags.map((tag) => (
							<span className={styles.tag} key={tag}>
								{tag}
							</span>
						))
					) : (
						<span className={styles.muted}>没有共同标签</span>
					)}
				</div>
			</section>
			<section className={styles.detailSection}>
				<h2>批量属性</h2>
				<label>
					<span>移动到分组</span>
					<WinComboBox
						ItemsSource={groupOptions}
						DisplayMemberPath="label"
						SelectedValuePath="value"
						SelectedValue={groupId}
						IsEnabled={!busy}
						onUpdate:SelectedValue={(value) => setGroupId(String(value ?? ""))}
					/>
				</label>
				<WinButton
					IsEnabled={!busy}
					onClick={() => void onUpdate({ groupId: groupId || null })}
				>
					应用分组
				</WinButton>
				<label>
					<span>统一优先级</span>
					<WinNumberBox
						Value={priority}
						Minimum={-9999}
						Maximum={9999}
						SpinButtonPlacementMode="Compact"
						IsEnabled={!busy}
						onUpdate:Value={setPriority}
					/>
				</label>
				<WinButton IsEnabled={!busy} onClick={() => void onUpdate({ priority })}>
					应用优先级
				</WinButton>
			</section>
		</div>
	)
}

export default function AddonManagerPage(): React.JSX.Element {
	const [snapshot, setSnapshot] = useState<AddonSnapshot | null>(null)
	const [search, setSearch] = useState("")
	const [selectedIds, setSelectedIds] = useState<string[]>([])
	const [busy, setBusy] = useState(true)
	const [progress, setProgress] = useState<AddonOperationProgress | null>(null)
	const [notice, setNotice] = useState<Notice | null>(null)
	const [settingsOpen, setSettingsOpen] = useState(false)
	const [groupDialog, setGroupDialog] = useState<"create" | "rename" | "delete" | null>(null)
	const [groupName, setGroupName] = useState("")

	const applySnapshot = useCallback((next: AddonSnapshot): void => {
		setSnapshot(next)
		setSelectedIds((current) =>
			current.filter((id) => next.addons.some((addon) => addon.id === id))
		)
	}, [])

	const fail = useCallback((error: unknown): void => {
		setNotice({
			severity: "Error",
			title: "操作失败",
			message: error instanceof Error ? error.message : String(error)
		})
	}, [])

	const perform = useCallback(
		async <T,>(task: () => Promise<T>, consume: (result: T) => void): Promise<void> => {
			setBusy(true)
			try {
				consume(await task())
			} catch (error) {
				fail(error)
			} finally {
				setBusy(false)
			}
		},
		[fail]
	)

	useEffect(() => {
		const unsubscribe = window.api.addons.onProgress(setProgress)
		void window.api.addons
			.getSnapshot()
			.then(applySnapshot)
			.catch(fail)
			.finally(() => setBusy(false))
		return unsubscribe
	}, [applySnapshot, fail])

	const preferences = snapshot?.preferences
	const groupTree = useMemo(() => buildGroupTree(snapshot?.groups ?? []), [snapshot?.groups])
	const selectedGroupItem = findGroupTreeItem(groupTree, preferences?.selectedGroupId ?? null)
	const filteredAddons = useMemo(
		() =>
			filterAndSortAddons(snapshot?.addons ?? [], {
				search,
				selectedGroupId: preferences?.selectedGroupId ?? null,
				source: preferences?.sourceFilter ?? "all",
				enabled: preferences?.enabledFilter ?? "all",
				problems: preferences?.problemFilter ?? "all",
				sortBy: preferences?.sortBy ?? "priority",
				sortDirection: preferences?.sortDirection ?? "descending"
			}),
		[preferences, search, snapshot?.addons]
	)
	const selectedAddons = useMemo(
		() => (snapshot?.addons ?? []).filter((addon) => selectedIds.includes(addon.id)),
		[selectedIds, snapshot?.addons]
	)
	const selectedListItems = filteredAddons.filter((addon) => selectedIds.includes(addon.id))
	const selectedGroup =
		snapshot?.groups.find((group) => group.id === preferences?.selectedGroupId) ?? null

	const updatePreferences = (update: Partial<AddonSnapshot["preferences"]>): void => {
		void perform(() => window.api.addons.updatePreferences(update), applySnapshot)
	}

	const check = (): void => {
		void perform(
			() => window.api.addons.check(),
			(result) => {
				applySnapshot(result.snapshot)
				setNotice({
					severity: result.issueCount > 0 ? "Warning" : "Success",
					title: "检查完成",
					message:
						result.issueCount > 0
							? "发现 " + result.issueCount + " 个需要关注的问题。"
							: "文件和 addonlist.txt 状态正常。"
				})
			}
		)
	}

	const push = (): void => {
		void perform(
			() => window.api.addons.push(),
			(result) => {
				applySnapshot(result.snapshot)
				setNotice({
					severity: result.warning ? "Warning" : "Success",
					title: "推送完成",
					message:
						result.warning ??
						(result.backupPath
							? "已更新 addonlist.txt，并备份到 " + result.backupPath
							: "已更新 addonlist.txt。")
				})
			}
		)
	}

	const openGroupDialog = (mode: "create" | "rename" | "delete"): void => {
		setGroupName(mode === "rename" ? (selectedGroup?.name ?? "") : "")
		setGroupDialog(mode)
	}

	const confirmGroupDialog = (): void => {
		if (!snapshot || !groupDialog) return
		if (groupDialog === "create") {
			void perform(
				() =>
					window.api.addons.createGroup(
						groupName.trim(),
						snapshot.preferences.selectedGroupId
					),
				applySnapshot
			)
		} else if (groupDialog === "rename" && selectedGroup) {
			void perform(
				() => window.api.addons.renameGroup(selectedGroup.id, groupName.trim()),
				applySnapshot
			)
		} else if (groupDialog === "delete" && selectedGroup) {
			void perform(() => window.api.addons.deleteGroup(selectedGroup.id), applySnapshot)
		}
	}

	const commandBarItems = [
		{
			Component: WinAppBarButton,
			Props: {
				Label: "打开目录",
				Icon: "OpenFile",
				IsEnabled: snapshot?.detection.status === "found" && !busy
			},
			Click: () => void window.api.addons.revealGameDirectory().catch(fail)
		},
		{
			Component: WinAppBarButton,
			Props: {
				Label: "检查",
				Icon: "Refresh",
				IsEnabled: snapshot?.detection.status === "found" && !busy
			},
			Click: check
		},
		{
			Component: WinAppBarButton,
			Props: {
				Label: snapshot?.dirty ? "推送 · 待处理" : "推送",
				Icon: "Send",
				IsEnabled: snapshot?.detection.status === "found" && !busy
			},
			Click: push
		},
		{
			Component: WinAppBarButton,
			Props: { Label: "设置", Icon: "Setting", IsEnabled: !busy },
			Click: () => setSettingsOpen(true)
		}
	]

	if (!snapshot) {
		return (
			<main className={styles.loading}>
				<div className={styles.spinner} />
				<p>正在检测 Steam 版《求生之路 2》…</p>
			</main>
		)
	}

	const gameFound = snapshot.detection.status === "found"

	return (
		<div className={styles.page}>
			<WinTitleBar
				PreferredHeightOption="Compact"
				style={{ "--TitleBarCompactHeight": "38px" }}
				LeftHeader={
					<WinCommandBar
						className={`${styles.commandBar} ${styles.titleBarCommandBar}`}
						DefaultLabelPosition="Right"
						HorizontalAlignment="Left"
						PrimaryCommands={commandBarItems}
					/>
				}
			/>
			<div className={styles.titleBarSearch}>
				<WinTextBox
					Value={search}
					PlaceholderText="搜索名称、文件名或标签"
					ShowDeleteButton
					onUpdate:Value={setSearch}
				/>
			</div>

			{notice && (
				<WinInfoBar
					className={styles.infoBar}
					IsOpen
					IsClosable
					Severity={notice.severity}
					Title={notice.title}
					Message={notice.message}
					onUpdate:IsOpen={(open: boolean) => {
						if (!open) setNotice(null)
					}}
				/>
			)}

			{gameFound ? (
				<div className={styles.workspace}>
					<section className={styles.explorer}>
						<div className={styles.explorerHeader}>
							<div className={styles.filters}>
								<WinComboBox
									ItemsSource={sourceOptions}
									DisplayMemberPath="label"
									SelectedValuePath="value"
									SelectedValue={snapshot.preferences.sourceFilter}
									onUpdate:SelectedValue={(value) =>
										updatePreferences({
											sourceFilter: String(
												value
											) as AddonSnapshot["preferences"]["sourceFilter"]
										})
									}
								/>
								<WinComboBox
									ItemsSource={enabledOptions}
									DisplayMemberPath="label"
									SelectedValuePath="value"
									SelectedValue={snapshot.preferences.enabledFilter}
									onUpdate:SelectedValue={(value) =>
										updatePreferences({
											enabledFilter: String(
												value
											) as AddonSnapshot["preferences"]["enabledFilter"]
										})
									}
								/>
								<WinComboBox
									ItemsSource={problemOptions}
									DisplayMemberPath="label"
									SelectedValuePath="value"
									SelectedValue={snapshot.preferences.problemFilter}
									onUpdate:SelectedValue={(value) =>
										updatePreferences({
											problemFilter: String(
												value
											) as AddonSnapshot["preferences"]["problemFilter"]
										})
									}
								/>
								<WinComboBox
									ItemsSource={sortOptions}
									DisplayMemberPath="label"
									SelectedValuePath="value"
									SelectedValue={snapshot.preferences.sortBy}
									onUpdate:SelectedValue={(value) =>
										updatePreferences({
											sortBy: String(
												value
											) as AddonSnapshot["preferences"]["sortBy"]
										})
									}
								/>
								<WinButton
									className={styles.sortButton}
									aria-label={`按优先级${snapshot.preferences.sortDirection === "ascending" ? "升序" : "降序"}排列`}
									title={`按优先级${snapshot.preferences.sortDirection === "ascending" ? "升序" : "降序"}排列`}
									onClick={() =>
										updatePreferences({
											sortDirection:
												snapshot.preferences.sortDirection === "ascending"
													? "descending"
													: "ascending"
										})
									}
								>
									{snapshot.preferences.sortDirection === "ascending" ? "↑" : "↓"}
								</WinButton>
							</div>
						</div>

						<div className={styles.explorerBody}>
							<aside className={styles.groupPane}>
								<div className={styles.paneHeading}>
									<strong>分组</strong>
									<div>
										<button
											type="button"
											aria-label="新建子分组"
											title="新建子分组"
											onClick={() => openGroupDialog("create")}
										>
											＋
										</button>
										<button
											type="button"
											aria-label="重命名分组"
											title="重命名"
											disabled={!selectedGroup}
											onClick={() => openGroupDialog("rename")}
										>
											
										</button>
										<button
											type="button"
											aria-label="删除分组"
											title="删除"
											disabled={!selectedGroup}
											onClick={() => openGroupDialog("delete")}
										>
											
										</button>
									</div>
								</div>
								<WinTreeView
									RootItems={groupTree}
									SelectionMode="Single"
									SelectedItem={selectedGroupItem}
									onUpdate:SelectedItem={(item: WinItem) => {
										const next = item as unknown as {
											groupId: string | null
										}
										updatePreferences({ selectedGroupId: next.groupId })
									}}
								/>
							</aside>
							<div className={styles.listPane}>
								<div className={styles.listHeading}>
									<strong>{filteredAddons.length} 个 Addon</strong>
									<span>
										{selectedIds.length > 0
											? "已选择 " + selectedIds.length + " 个"
											: ""}
									</span>
								</div>
								{filteredAddons.length > 0 ? (
									<WinListView
										className={styles.addonList}
										ItemsSource={filteredAddons as unknown as WinItem[]}
										SelectedItems={selectedListItems as unknown as WinItem[]}
										SelectionMode="Extended"
										ItemTemplate={(item: WinItem) => (
											<AddonRow addon={item as unknown as AddonRecord} />
										)}
										onUpdate:SelectedItems={(items: WinItem[]) =>
											setSelectedIds(
												items.map(
													(item) => (item as unknown as AddonRecord).id
												)
											)
										}
									/>
								) : (
									<div className={styles.emptyList}>
										<h2>这里没有 Addon</h2>
										<p>尝试切换分组或筛选条件，然后执行一次检查。</p>
									</div>
								)}
							</div>
						</div>
					</section>

					<aside className={styles.details}>
						{selectedAddons.length === 0 && <EmptyDetails />}
						{selectedAddons.length === 1 && (
							<SingleDetails
								key={selectedAddons[0].id + ":" + selectedAddons[0].modifiedAt}
								addon={selectedAddons[0]}
								groups={snapshot.groups}
								busy={busy}
								onEnabled={async (enabled) => {
									await perform(
										() =>
											window.api.addons.setAddonEnabled(
												selectedAddons[0].id,
												enabled
											),
										applySnapshot
									)
								}}
								onSave={async (update) => {
									await perform(
										() =>
											window.api.addons.updateAddon(
												selectedAddons[0].id,
												update
											),
										applySnapshot
									)
								}}
							/>
						)}
						{selectedAddons.length > 1 && (
							<MultiDetails
								key={selectedIds.join(":")}
								addons={selectedAddons}
								groups={snapshot.groups}
								busy={busy}
								onEnabled={async (enabled) => {
									await perform(
										() =>
											window.api.addons.setAddonsEnabled(
												selectedIds,
												enabled
											),
										applySnapshot
									)
								}}
								onUpdate={async (update) => {
									await perform(
										() => window.api.addons.updateAddons(selectedIds, update),
										applySnapshot
									)
								}}
							/>
						)}
					</aside>
				</div>
			) : (
				<section className={styles.notFound}>
					<div className={styles.notFoundIcon}></div>
					<h1>未检测到 Steam 版《求生之路 2》</h1>
					<p>{snapshot.detection.message}</p>
					<WinButton Style="AccentButtonStyle" IsEnabled={!busy} onClick={check}>
						重新扫描
					</WinButton>
					{snapshot.detection.diagnostics.length > 0 && (
						<details>
							<summary>检测详情</summary>
							<ul>
								{snapshot.detection.diagnostics.map((diagnostic) => (
									<li key={diagnostic}>{diagnostic}</li>
								))}
							</ul>
						</details>
					)}
				</section>
			)}

			<footer className={styles.statusBar}>
				<span>{progress && busy ? progress.message : busy ? "正在处理…" : "就绪"}</span>
				<span>
					{snapshot.addons.length} 个 Addon · {snapshot.issueCount} 个问题
					{snapshot.dirty ? " · 有未推送修改" : ""}
				</span>
			</footer>

			<WinContentDialog
				IsOpen={settingsOpen}
				Title="设置与检测信息"
				CloseButtonText="关闭"
				onUpdate:IsOpen={setSettingsOpen}
			>
				<div className={styles.dialogBody}>
					<p>第一版只自动发现 Windows Steam 版，不提供手动目录选择。</p>
					<dl className={styles.propertyList}>
						<div>
							<dt>Steam</dt>
							<dd>{snapshot.detection.steamPath ?? "未检测到"}</dd>
						</div>
						<div>
							<dt>游戏目录</dt>
							<dd>{snapshot.detection.gamePath ?? "未检测到"}</dd>
						</div>
						<div>
							<dt>addonlist.txt</dt>
							<dd>{snapshot.detection.addonListPath ?? "未检测到"}</dd>
						</div>
						<div>
							<dt>上次检查</dt>
							<dd>
								{snapshot.lastCheckedAt
									? formatDate(snapshot.lastCheckedAt)
									: "尚未检查"}
							</dd>
						</div>
						<div>
							<dt>上次推送</dt>
							<dd>
								{snapshot.lastPushedAt
									? formatDate(snapshot.lastPushedAt)
									: "尚未推送"}
							</dd>
						</div>
					</dl>
				</div>
			</WinContentDialog>

			<WinContentDialog
				IsOpen={groupDialog !== null}
				Title={
					groupDialog === "create"
						? "新建虚拟分组"
						: groupDialog === "rename"
							? "重命名分组"
							: "删除虚拟分组"
				}
				PrimaryButtonText={groupDialog === "delete" ? "删除" : "保存"}
				CloseButtonText="取消"
				IsPrimaryButtonEnabled={groupDialog === "delete" || groupName.trim().length > 0}
				onPrimaryButtonClick={confirmGroupDialog}
				onUpdate:IsOpen={(open: boolean) => {
					if (!open) setGroupDialog(null)
				}}
			>
				{groupDialog === "delete" ? (
					<p>
						删除“{selectedGroup?.name}”后，子分组和其中的 Addon 会移到它的上级分组；VPK
						文件不会被删除或移动。
					</p>
				) : (
					<div className={styles.dialogBody}>
						<label>
							<span>分组名称</span>
							<WinTextBox Value={groupName} onUpdate:Value={setGroupName} />
						</label>
						<p className={styles.muted}>
							分组仅保存在应用数据中，不改变 VPK 文件位置。
						</p>
					</div>
				)}
			</WinContentDialog>
		</div>
	)
}
