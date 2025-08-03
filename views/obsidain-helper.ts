import { uploadOneAttachments } from "apis";
import { App, Notice, TFile } from "obsidian";

export function getAttachmentPathsFromMarkdown(markdownText: string): string[] {
	const imageRegex = /!\[.*?\]\((.*?)\)|<img src="(.*?)"/g;
	const linkRegex = /\[.*?\]\((.*?)\)/g;
	const attachmentPaths = [];
	let match;

	// 提取图片路径
	while ((match = imageRegex.exec(markdownText)) !== null) {
		attachmentPaths.push(match[1] || match[2]);
	}

	// 提取链接路径
	while ((match = linkRegex.exec(markdownText)) !== null) {
		attachmentPaths.push(match[1]);
	}

	return attachmentPaths
		.filter((path) => path !== null)
		.filter((path) => path.length > 0)
		.filter((path) => {
			const suffix = path.split(".").pop();
			const arr = [
				"TXT",
				"MD",
				"MARKDOWN",
				"PDF",
				"HTML",
				"XLSX",
				"XLS",
				"DOCX",
				"CSV",
				"EML",
				"MSG",
				"PPTX",
				"PPT",
				"XML",
				"EPUB",
			];
			const fileType = suffix.toUpperCase();
			return arr.indexOf(fileType) >= 0;
		})
		.filter(
			(path) =>
				!(path.startsWith("http://") || path.startsWith("htts://"))
		);
}

export function getAbsPathFromResourceUrl(resourceUrl: string) {
	return decodeURIComponent(
		resourceUrl.replace(/app:\/\/[^\/]+\//, "/").split("?")[0]
	);
}

export async function readBinaryResourceFileWithObsidian(
	filePath: string,
	app: App,
	setMassage: (message: string) => void
): Promise<ArrayBuffer | null> {
	// 获取文件对象
	const file = app.vault.getAbstractFileByPath(filePath);
	if (file && file instanceof TFile) {
		// 如果文件存在并且是 File 类型
		setMassage(`${filePath} 读取中.....`);

		try {
			// 读取文件内容
			const data: ArrayBuffer = await app.vault.readBinary(file);
			console.log("File content:", data);
			setMassage(`${filePath} 读取完成 ${data.byteLength}字节`);
			return data; // 返回文件内容
		} catch (error) {
			setMassage(`${filePath} 读取失败`);
			console.error("Error reading file:", error);
		}
	} else {
		setMassage(`${filePath} 文件未找到`);
		console.error("File not found or not a valid file type");
	}
	return null;
}

export async function getAttachmentFilesFromMarkdown(
	markdownText: string,
	app: App,
	currentDocRootPath: string
): Promise<
	{ path: string; fileName: string; file: File | null; url: string | null }[]
> {
	const attachmentPaths = getAttachmentPathsFromMarkdown(markdownText);
	const attachments = await Promise.all(
		attachmentPaths.map(async (path) => {
			const resourcePath = currentDocRootPath + "/" + path;
			const fileName = path.split("/").pop();
			return {
				path: resourcePath,
				fileName: decodeURIComponent(fileName),
				// @ts-ignore
				file: null,
				// @ts-ignore
				url: null,
			};
		})
	);
	// @ts-ignore
	return attachments;
}

export function removeLeadingSlash(str: string): string {
	if (str.startsWith("/")) {
		return str.slice(1);
	}
	return str;
}
export function isWindows(): boolean {
	return process.platform === "win32";
}
export function linuxPathToWinPath(linuxPath: string): string {
	// 替换所有的正斜杠为反斜杠
	const winPath = linuxPath.replace(/\//g, "\\");
	return winPath;
}

export async function uploadAttachmentFiles(
	attachments: { path: string; fileName: string; file: File | null }[],
	app: App,
	currentDocRootPath: string,
	setMassage: (message: string) => void
): Promise<
	{ path: string; fileName: string; file: File | null; url: string | null }[]
> {
	const isWindowsPlatform = isWindows();
	const new_attachments = await Promise.all(
		attachments.map(async (attachment) => {
			const resourcePath = removeLeadingSlash(attachment.path);
			setMassage("开始上传附件 " + attachment.fileName + " 中...");
			//const readPath = isWindowsPlatform ? linuxPathToWinPath(decodeURIComponent(resourcePath)) : decodeURIComponent(resourcePath);
			const readPath = decodeURIComponent(resourcePath);
			setMassage(
				`是否为window平台:${isWindowsPlatform} 读取路径:${readPath}`
			);
			const fileBuffer: ArrayBuffer | null =
				await readBinaryResourceFileWithObsidian(
					readPath,
					app,
					setMassage
				);
			if (fileBuffer) {
				setMassage(
					`${attachment.path} 读取完成 ${fileBuffer?.byteLength}字节`
				);
			} else {
				setMassage(`${attachment.path} 读取失败 `);
				return attachment;
			}
			setMassage("开始上传附件 " + attachment.fileName + " 中...");
			if (fileBuffer) {
				const blob = new Blob([fileBuffer]);
				const file = new File([blob], `${attachment.fileName}`);
				const result = await uploadOneAttachments(
					file,
					attachment.fileName,
					setMassage
				);
				setMassage(
					"上传附件 " + attachment.fileName + " 完成 " + result[0].url
				);
				return {
					...attachment,
					url: result[0].url,
				};
			}
			return attachment;
		})
	);
	// @ts-ignore
	return new_attachments;
}

export function removeLinks(markdownText: string) {
	const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
	return markdownText.replace(linkPattern, ""); // 直接替换为空字符串
}

export function removeImages(markdownText: string) {
	const imagePattern = /!\[([^\]]*)\]\(([^)]*)\)/g;
	return markdownText.replace(imagePattern, ""); // 直接替换为空字符串
}

export function removeFiles(markdownText: string) {
	const filePattern =
		/\[([^\]]*)\]\(([^)]*\.(pdf|docx?|xlsx?|pptx?|zip|rar|txt))\)/g;
	return markdownText.replace(filePattern, ""); // 直接替换为空字符串
}

export function removeAllAttachments(markdownText: string) {
	return removeLinks(removeImages(removeFiles(markdownText)));
}
