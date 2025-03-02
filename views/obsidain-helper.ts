import { uploadOneAttachments } from "apis";
import { App, Notice, TFile } from "obsidian";
import mitt from 'mitt';

export function getAttachmentPathsFromMarkdown(markdownText: string) {
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

	return attachmentPaths;
}

export function getAbsPathFromResourceUrl(resourceUrl: string) {
	return decodeURIComponent(
		resourceUrl.replace(/app:\/\/[^\/]+\//, "/").split("?")[0]
	);
}

export async function readResourceFile(
	filePath: string,
	app: App
): Promise<ArrayBuffer | null> {
	// 获取文件对象
	const file = app.vault.getAbstractFileByPath(filePath);
	if (file && file instanceof TFile) {
		// 如果文件存在并且是 File 类型
      new Notice(`${filePath} 读取中.....`);

		try {
			// 读取文件内容
			const data: ArrayBuffer = await app.vault.readBinary(file);
			console.log("File content:", data);
         new Notice(`${filePath} 读取完成 ${data.byteLength}字节`);
			return data; // 返回文件内容
		} catch (error) {
         new Notice(`${filePath} 读取失败`);
			console.error("Error reading file:", error);
		}
	} else {
      new Notice(`${filePath} 文件未找到`);
		console.error("File not found or not a valid file type");
	}
	return null;
}

export async function getAttachmentFilesFromMarkdown(
	markdownText: string,
	app: App,
	currentDocRootPath: string
): Promise<{ path: string; fileName: string; file: File | null; url: string | null }[]> {
	const attachmentPaths = getAttachmentPathsFromMarkdown(markdownText);
	const attachments = await Promise.all(
		attachmentPaths.map(async (path) => {
			const resourcePath = currentDocRootPath + "/" + path;
			const fileName = path.split("/").pop();
         return {
				path: resourcePath,
				fileName: fileName,
				file: null,
            url: null,
			};
		})
	);
	// @ts-ignore
	return attachments;
}


export async function uploadAttachmentFiles(
	attachments: { path: string; fileName: string; file: File | null }[],
	app: App,
	currentDocRootPath: string
) :Promise<{ path: string; fileName: string; file: File | null; url: string | null }[]>{
   const emitter = mitt();
   const new_attachments = await Promise.all(
		attachments.map(async (attachment) => {
         const resourcePath = attachment.path;
         emitter.emit("UPLOAD_ATTACHMENT",{message:"开始上传附件 "+attachment.fileName});
			const fileBuffer: ArrayBuffer | null = await readResourceFile(
				resourcePath,
				app
			);
         new Notice(`${attachment.fileName} 读取完成 ${fileBuffer?.byteLength}字节`);
         if (fileBuffer) {
            const blob = new Blob([fileBuffer]);
            const file = new File([blob], `${attachment.fileName}`);
            const result=await uploadOneAttachments(file,attachment.fileName);
            emitter.emit("UPLOAD_ATTACHMENT",{message:"开始上传附件 "+attachment.fileName});
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

export async function getAttachmentUrlsFromMarkdown(
	markdownText: string,
	app: App,
	currentDocRootPath: string
): Promise<{ path: string; fileName: string; file: File | null; url: string | null }[]> {
	const attachmentPaths = getAttachmentPathsFromMarkdown(markdownText);
	const attachments = await Promise.all(
		attachmentPaths.map(async (path) => {
			const resourcePath = currentDocRootPath + "/" + path;
			const fileName = path.split("/").pop();
			const fileBuffer: ArrayBuffer | null = await readResourceFile(
				resourcePath,
				app
			);
			if (fileBuffer) {
				const blob = new Blob([fileBuffer]);
				const file = new File([blob], `${fileName}`);
				// @ts-ignore
				const result=await uploadOneAttachments(file,fileName);
				return {
					path: resourcePath,
					fileName: fileName,
					file: file,
               ...result[0]
				};
			} else {
				return {
					path: resourcePath,
					fileName: fileName,
					file: null,
				};
			}
		})
	);
	new Notice(`attachments:${JSON.stringify(attachments)}`);
	return attachments;
}
