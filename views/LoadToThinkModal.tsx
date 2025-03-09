import { zodResolver } from "@hookform/resolvers/zod";
import { md5 } from "js-md5";
import { marked } from "marked";
import { App, Modal, Notice } from "obsidian";
import * as React from "react";
import { useState } from "react";
import { createRoot, Root } from "react-dom/client";
import { useForm } from "react-hook-form";
import * as z from "zod";

import {
	getChannels,
	getObsidianToThinkGeneratePromptList,
	runDifyFlow,
} from "../apis";
import {
	getAbsPathFromResourceUrl,
	getAttachmentFilesFromMarkdown,
	removeAllAttachments,
	uploadAttachmentFiles,
} from "./obsidain-helper";
import { allUrlHasValueInArray, getCurrentDateTime } from "./urils";
marked.use({
	async: false,
	pedantic: false,
	gfm: true,
});
interface FoldSpaceHelperReactViewProps {
	title: string;
	filePath: string;
	content: string;
	currentDocRootPath: string;
	app: App;
	attachments: {
		path: string;
		fileName: string;
		file: ArrayBuffer | null;
		url: string | null;
	}[];
}

const formSchema = z.object({
	doc_title: z.string().min(1, { message: "标题必须存在" }),
	doc_content: z.string().min(3, { message: "内容必须存在" }),
	documents: z.array(z.string()).optional(),
	channel_id: z.string().min(1, { message: "频道必须存在" }),
	prompt_id: z.string().min(1, { message: "提示词必须存在" }),
	partitioned_mode: z.string().min(1, { message: "字数分块大小必须存在" }),
	partitioned_chunk_size: z.number().optional(),
	vector_uuid: z.string().min(1, { message: "向量ID必须存在" }),
	if_create_vector_db: z.string().optional(),
	knowledge_chunk_size: z
		.number()
		.min(100, { message: "知识块大小必须大于100" })
		.max(2000, { message: "知识块大小必须小于2000" }),
	knowledge_chunk_overlap: z
		.number()
		.min(10, { message: "知识块重叠大小必须大于10" })
		.max(300, { message: "知识块重叠大小必须小于300" }),
	knowledge_query_limit: z
		.number()
		.min(1, { message: "知识库查询限制必须大于1" })
		.max(10, { message: "知识库查询限制必须小于10" }),
	if_run_doc_intro_workflow: z.string().optional(),
});
export const FoldSpaceHelperReactView = (
	props: FoldSpaceHelperReactViewProps
) => {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [attachments, setAttachments] = useState(props.attachments);
	// @ts-ignore
	const [channels, setChannels] = useState<object[]>([]);
	const [generatePromptList, setGeneratePromptList] = useState<object[]>([]);
	const [messageModalIsVisible, setMessageModalIsVisible] = useState(false);
	// @ts-ignore
	const [modal2IsVisible, setModal2IsVisible] = useState(false);
	const [submitButtonDisabled, setSubmitButtonDisabled] = useState(false);
	const [runFlowMessages, setRunFlowMessages] = useState<string[]>([]);
	const [resultDocUrl, setResultDocUrl] = useState<string>("");
	const addRunFlowMessageRecord = (message: string) => {
		setRunFlowMessages((prev) => [...prev, message]);
	};
	React.useEffect(() => {
		setAttachments(props.attachments);
	}, [props.attachments]);
	React.useEffect(() => {
		getChannels()
			.then((res) => {
				setChannels(res);
			})
			.catch((err) => {
				alert(err);
			});
	}, []);
	React.useEffect(() => {
		getObsidianToThinkGeneratePromptList()
			.then((res) => {
				setGeneratePromptList(res);
			})
			.catch((err) => {
				addRunFlowMessageRecord(`获取提示词失败 ${err}\n${err.stack}`);
			});
	}, []);
	const {
		register,
		handleSubmit,
		watch,
		formState: { errors },
		trigger,
		getValues,
		setValue,
	} = useForm({
		resolver: zodResolver(formSchema),
		defaultValues: {
			doc_title: props.title,
			doc_content: props.content,
			partitioned_mode: "按段落",
			vector_uuid: getCurrentDateTime() + "_" + md5(props.content),
			if_create_vector_db: "1",
			if_run_doc_intro_workflow: "0",
			partitioned_chunk_size: 1000,
			knowledge_chunk_size: 500,
			knowledge_chunk_overlap: 100,
			knowledge_query_limit: 1,
			documents: [],
		},
	});
	const partitioned_mode = watch("partitioned_mode");
	// @ts-ignore
	const updateAttachments = async (
		// @ts-ignore
		attachments: any[],
		setMassage: (message: string) => void
	) => {
		// @ts-ignore
		if (attachments.length > 0 && !allUrlHasValueInArray(attachments)) {
			setSubmitButtonDisabled(true);
			setMassage("开始上传附件 中...");
			// @ts-ignore
			const new_attachments = await uploadAttachmentFiles(
				attachments,
				props.app,
				props.currentDocRootPath,
				setMassage
			);
			// @ts-ignore
			setAttachments(new_attachments);
			// @ts-ignore
			const documents = new_attachments.map((item: any) => item.url);
			setMassage(
				`上传附件完成 ${documents.length} 个附件 ${JSON.stringify(
					documents
				)}`
			);
			setValue("documents", documents);
			setSubmitButtonDisabled(false);
		} else {
			setMassage(`无需上传 ${attachments.length} 个附件`);
		}
	};
	const onSubmit = (data: any) => {
		alert("submit");
		console.log("Form data:", data);
		new Notice(`form:${JSON.stringify(data)}`);
		// 在这里处理表单提交
	};
	const numberFieldOptions = {
		valueAsNumber: true,
		parse: (value: any) => Number(value),
	};
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				fontSize: 12,
				position: "relative",
			}}
		>
			<form onSubmit={handleSubmit(onSubmit)}>
				<div className="row" style={{ width: "100%" }}>
					<center>
						<h1>FoldSpece助手</h1>
					</center>
				</div>
				<div className="row" style={{ width: "100%", marginBottom: 4 }}>
					<input
						style={{ width: "100%" }}
						type="text"
						{...register("doc_title")}
						className="form-control"
						placeholder="请输入要导入的文件路径"
					/>
					{errors?.doc_title && (
						<p style={{ color: "red" }}>
							{errors.doc_title.message}
						</p>
					)}
				</div>
				<div className="row" style={{ width: "100%", marginBottom: 4 }}>
					<textarea
						style={{ width: "100%", height: 300 }}
						className="form-control"
						{...register("doc_content")}
					></textarea>
					{errors?.doc_content && (
						<p style={{ color: "red" }}>
							{errors.doc_content.message}
						</p>
					)}
				</div>

				<div className="row" style={{ width: "100%", marginBottom: 4 }}>
					<div
						className="col"
						style={{
							display: "inline-block",
							paddingRight: 32,
							width: "20%",
							textAlign: "right",
						}}
					>
						提示词选择
					</div>
					<div
						className="col"
						style={{ display: "inline-block", width: "80%" }}
					>
						<select
							style={{ width: "100%" }}
							{...register("prompt_id")}
							className="form-control"
						>
							{generatePromptList.map((item: any, index) => {
								return (
									<option value={item.id} key={index}>
										{item.id} - {item.name}
									</option>
								);
							})}
						</select>
						{errors?.prompt_id && (
							<p style={{ color: "red" }}>
								{errors.prompt_id.message}
							</p>
						)}
					</div>
					<div
						className="row"
						style={{
							width: "100%",
							fontSize: 12,
							paddingLeft: "20%",
							paddingRight: "20%",
							marginTop: 8,
						}}
					>
						<a
							href="https://nocodb.apps.foldspace.cn/dashboard/#/nc/view/654f6e4d-9031-4ee8-b993-b7cd7b2c3a33"
							target="_blank"
							style={{ textDecoration: "none", color: "blue" }}
						>
							提示词列表
						</a>
						<span style={{ paddingLeft: 10, paddingRight: 10 }}>
							|
						</span>
						<a
							href="https://nocodb.apps.foldspace.cn/dashboard/#/nc/form/85ce8c53-0a35-4a70-9089-a7322664dda5"
							target="_blank"
							style={{ textDecoration: "none", color: "blue" }}
						>
							新增提示词
						</a>
					</div>
				</div>
				<div className="row" style={{ width: "100%", marginBottom: 8 }}>
					<div
						className="col"
						style={{
							display: "inline-block",
							paddingRight: 32,
							width: "20%",
							textAlign: "right",
						}}
					>
						频道选择
					</div>
					<div
						className="col"
						style={{ display: "inline-block", width: "80%" }}
					>
						<select
							style={{ width: "100%" }}
							className="form-control"
							{...register("channel_id")}
						>
							{channels.map((channel: any, index) => {
								return (
									<option
										// @ts-ignore
										value={channel.id}
										key={index}
									>
										{`${channel && channel.id}-${
											channel && channel.name
										}`}
									</option>
								);
							})}
						</select>
						{errors?.channel_id && (
							<p style={{ color: "red" }}>
								{errors.channel_id.message}
							</p>
						)}
					</div>
				</div>
				<div className="row" style={{ width: "100%", marginBottom: 8 }}>
					<div
						className="col"
						style={{
							display: "inline-block",
							paddingRight: 32,
							width: "20%",
							textAlign: "right",
						}}
					>
						分块策略
					</div>
					<div
						className="col"
						style={{ display: "inline-block", width: "80%" }}
					>
						<label>
							<input
								type="radio"
								value="按段落"
								{...register("partitioned_mode")}
							/>
							按段落
						</label>
						<label>
							<input
								type="radio"
								value="按标题段落"
								{...register("partitioned_mode")}
							/>
							按标题段落
						</label>
						<label>
							<input
								type="radio"
								value="按字数"
								{...register("partitioned_mode")}
							/>
							按字数
						</label>
						<label>
							<input
								type="radio"
								value="不分块"
								{...register("partitioned_mode")}
							/>
							不分块
						</label>
						{errors?.partitioned_mode && (
							<p style={{ color: "red" }}>
								{errors.partitioned_mode.message}
							</p>
						)}
					</div>
				</div>
				{partitioned_mode === "按字数" && (
					<div
						className="row"
						style={{ width: "100%", marginBottom: 8 }}
					>
						<div
							className="col"
							style={{
								display: "inline-block",
								paddingRight: 0,
								width: "20%",
								textAlign: "right",
							}}
						>
							字数分块大小
						</div>
						<div
							className="col"
							style={{ display: "inline-block", width: "80%" }}
						>
							<input
								type="number"
								style={{ width: "100%" }}
								className="form-control"
								{...register(
									"partitioned_chunk_size",
									numberFieldOptions
								)}
							/>
						</div>
						{errors?.partitioned_chunk_size && (
							<p style={{ color: "red" }}>
								{errors.partitioned_chunk_size.message}
							</p>
						)}
					</div>
				)}
				<div
					className="row"
					style={{ width: "100%", marginBottom: 0, fontSize: 10 }}
				>
					<div
						className="col"
						style={{ display: "inline-block", width: "30%" }}
					>
						<div
							className="col"
							style={{
								display: "inline-block",
								paddingRight: 0,
								width: "50%",
								textAlign: "right",
							}}
						>
							知识库:分块大小
						</div>
						<div
							className="col"
							style={{ display: "inline-block", width: "50%" }}
						>
							<input
								type="number"
								style={{ width: "100%" }}
								className="form-control"
								{...register(
									"knowledge_chunk_size",
									numberFieldOptions
								)}
							/>
						</div>
					</div>
					<div
						className="col"
						style={{ display: "inline-block", width: "30%" }}
					>
						<div
							className="col"
							style={{
								display: "inline-block",
								paddingRight: 0,
								width: "50%",
								textAlign: "right",
							}}
						>
							Overlap大小
						</div>
						<div
							className="col"
							style={{ display: "inline-block", width: "50%" }}
						>
							<input
								type="number"
								style={{ width: "100%" }}
								className="form-control"
								{...register(
									"knowledge_chunk_overlap",
									numberFieldOptions
								)}
							/>
						</div>
					</div>
					<div
						className="col"
						style={{ display: "inline-block", width: "40%" }}
					>
						<div
							className="col"
							style={{
								display: "inline-block",
								paddingRight: 0,
								width: "50%",
								textAlign: "right",
							}}
						>
							匹配数量
						</div>
						<div
							className="col"
							style={{ display: "inline-block", width: "50%" }}
						>
							<input
								type="number"
								style={{ width: "100%" }}
								className="form-control"
								{...register(
									"knowledge_query_limit",
									numberFieldOptions
								)}
							/>
						</div>
					</div>
					{errors?.knowledge_chunk_size && (
						<p style={{ color: "red" }}>
							{errors.knowledge_chunk_size.message}
						</p>
					)}
					{errors?.knowledge_chunk_overlap && (
						<p style={{ color: "red" }}>
							{errors.knowledge_chunk_overlap.message}
						</p>
					)}
					{errors?.knowledge_query_limit && (
						<p style={{ color: "red" }}>
							{errors.knowledge_query_limit.message}
						</p>
					)}
				</div>
				<div className="row" style={{ width: "100%", marginBottom: 8 }}>
					<div
						className="col"
						style={{
							display: "inline-block",
							width: "20%",
							textAlign: "left",
						}}
					>
						是否使用知识库
					</div>
					<div
						className="col"
						style={{
							display: "inline-block",
							width: "20%",
							textAlign: "left",
						}}
					>
						<label>
							<input
								type="radio"
								value={"1"}
								{...register("if_create_vector_db")}
							/>
							是
						</label>
						<label>
							<input
								type="radio"
								value={"0"}
								{...register("if_create_vector_db")}
							/>
							否
						</label>
						{errors?.if_create_vector_db && (
							<p style={{ color: "red" }}>
								{errors.if_create_vector_db.message}
							</p>
						)}
					</div>
					<div
						className="col"
						style={{
							display: "inline-block",
							paddingRight: 32,
							width: "60%",
							textAlign: "left",
						}}
					>
						{attachments.map((attachment, index) => {
							return (
								<p
									style={{ marginLeft: 12 }}
									key={index}
									// @ts-ignore
									alt={`${attachment}`}
								>
									<a
										// @ts-ignore
										href={attachment.url}
										target="_blank"
										style={{
											color: attachment.url
												? "blue"
												: "red",
										}}
									>
										附件{index + 1}: {attachment.fileName}{" "}
										-|{attachment.url ? "已上传" : "未上传"}
									</a>
								</p>
							);
						})}
					</div>
				</div>
				<div className="row" style={{ width: "100%", marginBottom: 8 }}>
					<div
						className="col"
						style={{
							display: "inline-block",
							paddingRight: 32,
							width: "20%",
							textAlign: "right",
						}}
					>
						向量标记ID
					</div>
					<div
						className="col"
						style={{ display: "inline-block", width: "80%" }}
					>
						<input
							style={{ width: "100%" }}
							type="text"
							className="form-control"
							disabled={true}
							{...register("vector_uuid")}
						/>
					</div>
					<p>
						<a
							href={`http://192.168.31.56:6333/dashboard#/collections`}
							target="_blank"
							style={{ color: "blue" }}
						>
							向量数据库集合
						</a>
					</p>
					{errors?.vector_uuid && (
						<p style={{ color: "red" }}>
							{errors.vector_uuid.message}
						</p>
					)}
				</div>
				<div className="row" style={{ width: "100%", marginBottom: 8 }}>
					<div
						className="col"
						style={{
							display: "inline-block",
							width: "20%",
							textAlign: "left",
						}}
					>
						是否运行文章摘要流程
					</div>
					<div
						className="col"
						style={{
							display: "inline-block",
							width: "80%",
							textAlign: "left",
						}}
					>
						<label>
							<input
								type="radio"
								value={"1"}
								{...register("if_run_doc_intro_workflow")}
							/>
							是
						</label>
						<label>
							<input
								type="radio"
								value={"0"}
								{...register("if_run_doc_intro_workflow")}
							/>
							否
						</label>
						{errors?.if_run_doc_intro_workflow && (
							<p style={{ color: "red" }}>
								{errors.if_run_doc_intro_workflow.message}
							</p>
						)}
					</div>
				</div>
				<div className="row" style={{ width: "100%", marginBottom: 8 }}>
					<div
						className="col"
						style={{
							display: "inline-block",
							paddingRight: 32,
							width: "40%",
							textAlign: "right",
						}}
					></div>
					<div
						className="col"
						style={{ display: "inline-block", width: "60%" }}
					>
						<button
							className="btn btn-primary"
							type="button"
							style={{ marginRight: 12 }}
							onClick={() => {
								setModal2IsVisible(true);
							}}
						>
							显示props
						</button>
						<button
							className="btn btn-primary"
							type="button"
							disabled={submitButtonDisabled}
							onClick={async () => {
								setRunFlowMessages((prev) => [
									"开始验证表单...",
								]);
								setResultDocUrl("");
								const isValid = await trigger();
								new Notice(`开始验证表单, 验证结果:${isValid}`);
								if (isValid) {
									// 验证通过，手动调用 handleSubmit
									const data = getValues();
									if (data.if_create_vector_db === "1") {
										try {
											setMessageModalIsVisible(true);
											addRunFlowMessageRecord(
												"开始上传附件..."
											);
											await updateAttachments(
												attachments,
												addRunFlowMessageRecord
											);
											addRunFlowMessageRecord(
												"上传附件完成..."
											);
										} catch (error) {
											addRunFlowMessageRecord(
												`上传附件失败 ${error}\n${error.stack}`
											);
											console.error(
												"上传附件失败",
												error
											);
										} finally {
											setSubmitButtonDisabled(false);
										}
									}
									try {
										setSubmitButtonDisabled(true);
										//setModal1IsVisible(true);
										const data = getValues();
										addRunFlowMessageRecord(
											"开始运行流程..."
										);
										const beginTime = new Date().getTime();
										const interval = setInterval(() => {
											addRunFlowMessageRecord(
												`任务运行中... 已经开始 ${
													(new Date().getTime() -
														beginTime) /
													1000
												} 秒`
											);
										}, 10 * 1000);
										try {
											const difyOut = await runDifyFlow(
												data,
												addRunFlowMessageRecord
											);
											const final_text =
												difyOut?.data?.outputs?.text;
											const final_obj = JSON.parse(
												final_text || "{}"
											);
											setResultDocUrl(
												final_obj?.doc_url || ""
											);
											addRunFlowMessageRecord(
												"运行流程完成..."
											);
										} catch (error) {
											console.error(
												"运行流程失败",
												error
											);
											addRunFlowMessageRecord(
												`运行流程失败 ${error}`
											);
										} finally {
											clearInterval(interval);
										}
									} catch (error) {
										console.error("运行流程失败", error);
										if (error instanceof Error) {
											addRunFlowMessageRecord(
												`${error.message}\n运行流程失败 ${error.stack}`
											);
										} else {
											addRunFlowMessageRecord(
												`运行流程失败 ${error}`
											);
										}
									} finally {
										setSubmitButtonDisabled(false);
									}
								} else {
									new Notice(
										`验证失败 ${JSON.stringify(errors)} `
									);
								}
							}}
						>
							提交任务
						</button>
					</div>
				</div>
			</form>
			{messageModalIsVisible && (
				<div
					style={{
						position: "absolute",
						bottom: 0,
						top: 0,
						left: 0,
						right: 0,
						width: "100%",
						height: "100%",
						backgroundColor: "#f0f0f0",
						zIndex: 1000,
						opacity: 1,
					}}
				>
					<div>
						<button
							style={{ float: "right" }}
							onClick={() => {
								setMessageModalIsVisible(false);
							}}
						>
							关闭
						</button>
					</div>
					<div>
						<h1>执行日志</h1>
						<pre>{runFlowMessages.join("\n")}</pre>
					</div>
					<div>
						<p>
							<a
								href="https://diyf.apps.foldspace.cn/app/708cb23f-5a12-4209-a19b-560e06511742/logs"
								target="_blank"
								style={{
									textDecoration: "none",
									color: "blue",
								}}
							>
								查看dify任务日志
							</a>
							<span style={{ marginLeft: 12, marginRight: 12 }}>
								{" "}
								|{" "}
							</span>
							<a
								href="https://nocodb.apps.foldspace.cn/dashboard/#/nc/p2kg9yuerbjozs8/mua5zut94cdsj2v/vwcym9tcdgqfsdhh/view"
								target="_blank"
								style={{
									textDecoration: "none",
									color: "blue",
								}}
							>
								查看生成结果
							</a>
							{resultDocUrl && (
								<span
									style={{ marginLeft: 12, marginRight: 12 }}
								>
									{" "}
									|{" "}
								</span>
							)}
							{resultDocUrl && (
								<a
									href={resultDocUrl}
									target="_blank"
									style={{
										textDecoration: "none",
										color: "blue",
									}}
								>
									{resultDocUrl}
								</a>
							)}
						</p>
					</div>
					<div>
						<h1>提交values</h1>
						<pre>{JSON.stringify(getValues(), null, 4)}</pre>
					</div>
				</div>
			)}
			{modal2IsVisible && (
				<div
					style={{
						position: "absolute",
						bottom: 0,
						top: 0,
						left: 0,
						right: 0,
						width: "100%",
						height: "100%",
						backgroundColor: "#f0f0f0",
						zIndex: 1000,
					}}
				>
					<div>
						<button
							style={{ float: "right" }}
							onClick={() => {
								setModal2IsVisible(false);
							}}
						>
							关闭
						</button>
					</div>
					<div>
						<h1>props</h1>
						<p>
							{JSON.stringify(
								{
									attachments: attachments,
									filePath: props.filePath,
									// @ts-ignore
									resourceUrl: props.resourceUrl,
									// @ts-ignore
									currentDocRootPath:
										props.currentDocRootPath,
									// @ts-ignore
									fileFullPath: props.fileFullPath,
									// @ts-ignore
								},
								null,
								4
							)}
						</p>
					</div>
					<div>
						<h1>values</h1>
						<pre>{JSON.stringify(getValues(), null, 4)}</pre>
					</div>
				</div>
			)}
		</div>
	);
};
/**
 * https://luhaifeng666.github.io/obsidian-plugin-docs-zh/zh2.0/getting-started/react.html
 */
// @ts-ignore
export class LoadToThinkModal extends Modal {
	private root: Root;
	private app: App;
	constructor(app: App) {
		super(app);
		this.app = app;
	}
	async getFileTitle() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			return;
		}
		const title = activeFile.basename;
		return title;
	}

	async getFileContent() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			return;
		}
		const fileContent = await this.app.vault.read(activeFile);
		return fileContent;
	}
	async onOpen() {
		const { containerEl, app } = this;
		this.root = createRoot(containerEl.children[1]);
		const title = await this.getFileTitle();
		const content = await this.getFileContent();
		const contentWithoutAttachments = removeAllAttachments(content);
		// let filePath = app.vault.getResourcePath( as TFile);
		const filePath = app.workspace.getActiveFile()?.path;
		// @ts-ignore
		const resourceUrl = app.vault.adapter.getResourcePath(filePath);
		// @ts-ignore
		const currentDocRootPath = filePath.split("/").slice(0, -1).join("/");
		const fileFullPath = getAbsPathFromResourceUrl(resourceUrl);
		// @ts-ignore
		const attachments = await getAttachmentFilesFromMarkdown(
			// @ts-ignore
			content,
			app,
			currentDocRootPath
		);
		// @ts-ignore
		this.root.render(
			<React.StrictMode>
				<FoldSpaceHelperReactView
					// @ts-ignore
					title={title}
					// @ts-ignore
					content={contentWithoutAttachments}
					filePath={fileFullPath}
					// @ts-ignore
					attachments={attachments}
					app={app}
					currentDocRootPath={currentDocRootPath}
				/>
			</React.StrictMode>
		);
		//contentEl.setText('Woah!');
	}

	async onClose() {
		const { contentEl } = this;
		this.root.unmount();
		contentEl.empty();
	}
}
