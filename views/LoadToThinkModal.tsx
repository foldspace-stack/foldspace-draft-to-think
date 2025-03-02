import { zodResolver } from "@hookform/resolvers/zod";
import { marked } from "marked";
import { App, Modal, Notice } from "obsidian";
import * as React from "react";
import { useState } from "react";
import { createRoot, Root } from "react-dom/client";
import { useForm } from "react-hook-form";
import * as z from "zod";
import md5 from "js-md5";

import {
	getChannels,
	getObsidianToThinkGeneratePromptList,
	runDifyFlow,
} from "../apis";
import {
	getAbsPathFromResourceUrl,
	getAttachmentFilesFromMarkdown,
	getAttachmentUrlsFromMarkdown,
	uploadAttachmentFiles,
} from "./obsidain-helper";
import { allUrlHasValueInArray } from "./urils";
import mitt from "mitt";
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
	doc_title: z.string().min(3, { message: "标题必须存在" }),
	doc_content: z.string().min(3, { message: "内容必须存在" }),
	documents: z.array(z.string()).optional(),
	channel_id: z.string().min(1, { message: "频道必须存在" }),
	prompt_id: z.string().min(1, { message: "提示词必须存在" }),
	partitioned_mode: z.string().min(1, { message: "字数分块大小必须存在" }),
	partitioned_chunk_size: z.number().optional(),
	vector_uuid: z.string().min(1, { message: "向量ID必须存在" }),
	if_create_vector_db: z.string().optional(),
	if_run_doc_intro_workflow: z.string().optional(),
});
export const FoldSpaceHelperReactView = (
	props: FoldSpaceHelperReactViewProps
) => {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [attachments, setAttachments] = useState(props.attachments);
	const [channels, setChannels] = useState<any[]>([]);
	const [generatePromptList, setGeneratePromptList] = useState<any[]>([]);
	const [uploadAttachmentModalIsVisible, setUploadAttachmentModalIsVisible] =
		useState(false);
	const [modal2IsVisible, setModal2IsVisible] = useState(false);
	const [submitButtonDisabled, setSubmitButtonDisabled] = useState(false);
	const [uploadAttachmentMessage, setUploadAttachmentMessage] = useState("");
	React.useEffect(() => {
		setAttachments(props.attachments);
	}, [props.attachments]);
	React.useEffect(() => {
		getChannels().then((res) => {
			setChannels(res);
		});
	}, []);
	React.useEffect(() => {
		getObsidianToThinkGeneratePromptList().then((res) => {
			setGeneratePromptList(res);
		});
	}, []);
	React.useEffect(() => {
		const emitter = mitt();
		emitter.on("UPLOAD_ATTACHMENT", (data: any) => {
			console.log(data);
			setUploadAttachmentMessage(data.message);
		});
		return () => {
			emitter.off("UPLOAD_ATTACHMENT");
		};
	}, []);
	const {
		register,
		handleSubmit,
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
			vector_uuid: md5(props.content),
			if_create_vector_db: "1",
			if_run_doc_intro_workflow: "0",
			partitioned_chunk_size: 1000,
			documents: [],
		},
	});
	const updateAttachments = async (attachments: any) => {
		if (attachments.length > 0 && !allUrlHasValueInArray(attachments)) {
			setSubmitButtonDisabled(true);
			new Notice("开始上传附件 中...");
			const new_attachments = await uploadAttachmentFiles(
				attachments,
				props.app,
				props.currentDocRootPath
			);
			setAttachments(new_attachments);
			const documents = new_attachments.map((item: any) => item.url);
			new Notice(
				`上传附件完成 ${documents.length} 个附件 ${JSON.stringify(
					documents
				)}`
			);
			setValue("documents", documents);
			setSubmitButtonDisabled(false);
		} else {
			new Notice(`无需上传 ${attachments.length} 个附件`);
		}
	};
	const onSubmit = (data: any) => {
		alert("submit");
		console.log("Form data:", data);
		new Notice(`form:${JSON.stringify(data)}`);
		// 在这里处理表单提交
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
				<div className="row" style={{ width: "100%", marginBottom: 8 }}>
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
				<div className="row" style={{ width: "100%", marginBottom: 8 }}>
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
							{generatePromptList.map((item, index) => {
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
							{channels.map((channel, index) => {
								return (
									<option value={channel.id} key={index}>
										{channel.id} - {channel.name}
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
							{...register("partitioned_chunk_size")}
							defaultValue={1000}
						/>
					</div>
					{errors?.partitioned_chunk_size && (
						<p style={{ color: "red" }}>
							{errors.partitioned_chunk_size.message}
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
									alt={`${attachment}`}
								>
									<a
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
							disabled={submitButtonDisabled}
							onClick={async () => {
								const isValid = await trigger();
                        new Notice(`开始验证表单, 验证结果:${isValid}`);
								if (isValid) {
									// 验证通过，手动调用 handleSubmit
									const data = getValues();
									if (data.if_create_vector_db === "1") {
										try {
											setUploadAttachmentModalIsVisible(
												true
											);
											await updateAttachments(
												attachments
											);
										} catch (error) {
											alert(`上传附件失败 ${error}`);
											console.error(
												"上传附件失败",
												error
											);
										} finally {
											setSubmitButtonDisabled(false);
											setUploadAttachmentModalIsVisible(
												false
											);
										}
									}
									try {
										setSubmitButtonDisabled(true);
										//setModal1IsVisible(true);
										const data = getValues();
										await runDifyFlow(data);
									} catch (error) {
										console.error("运行流程失败", error);
										alert(`运行流程失败 ${error}`);
									} finally {
										setSubmitButtonDisabled(false);
									}
								} else {
									new Notice(
										`验证失败 ${JSON.stringify(
											errors
										)} }`
									);
								}
							}}
						>
							提交任务
						</button>
					</div>
				</div>
			</form>
			{uploadAttachmentModalIsVisible && (
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
						opacity: 0.5,
					}}
				>
					<div>
						<h1>上传附件中...</h1>
						<p>{uploadAttachmentMessage}</p>
                  <p>{JSON.stringify(getValues())}</p>
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
						opacity: 0.5,
					}}
				>
					hello
				</div>
			)}
		</div>
	);
};
/**
 * https://luhaifeng666.github.io/obsidian-plugin-docs-zh/zh2.0/getting-started/react.html
 */
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
		// let filePath = app.vault.getResourcePath( as TFile);
		const filePath = app.workspace.getActiveFile()?.path;
		const resourceUrl = app.vault.adapter.getResourcePath(filePath);
		const currentDocRootPath = filePath.split("/").slice(0, -1).join("/");
		const fileFullPath = getAbsPathFromResourceUrl(resourceUrl);
		const attachments = await getAttachmentFilesFromMarkdown(
			content,
			app,
			currentDocRootPath
		);

		this.root.render(
			<React.StrictMode>
				<FoldSpaceHelperReactView
					title={title}
					content={content}
					filePath={fileFullPath}
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
