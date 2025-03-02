import axios from "axios";
import mitt from "mitt";
import { Notice } from "obsidian";

export const ApiSdk = axios.create({
	//baseURL: "http://openapi.inner.foldspace.cn",
   baseURL: "http://127.0.0.1:8000",

	timeout: 1000 * 60 * 5,
	headers: {
		"Content-type": "application/json",
		Accept: "text/json",
	},
});

export const uploadAttachments = async (attachments: File[],fileName:string) => {
	const formData = new FormData();
	attachments.forEach((attachment) => {
		formData.append("attachments", attachment);
	});
   const emitter = mitt();
	const response = await ApiSdk.post(
		"/bff/v1/apps/obsidian/attachments/upload",
		formData,
		{
			headers: {
				"Content-Type": "multipart/form-data",
			},
			onUploadProgress: (progressEvent) => {
				const { loaded, total } = progressEvent;
				const percentCompleted = Math.round((loaded * 100) / total);
            emitter.emit("UPLOAD_ATTACHMENT",{message:`上传进度: ${percentCompleted}% ${fileName}`});
			},
		}
	);
	return response.data;
};

export const uploadOneAttachments = async (file: File, fileName: string) => {
	const formData = new FormData();
	formData.append("files", file, fileName);
	const url = `http://openapi.inner.foldspace.cn/bff/v1/apps/obsidian/attachments/upload`;
	new Notice(`开始Ajax上传文件: ${fileName} size:${file.size} =>${url}`);
	//const response = await uploadFile(formData, url);
   const response = await await axios.post(url, formData, {
      headers: {
          'Content-Type': 'multipart/form-data', // 设置请求头
      },
      onDownloadProgress: (progressEvent) => {
         const { loaded, total } = progressEvent;
         const percentCompleted = Math.round((loaded * 100) / total);
         
         console.log(`下载进度: ${percentCompleted}%`);
     },
  });
	new Notice(`上传文件: ${fileName} 完成 ${JSON.stringify(response.data)}`);
	return response.data;
};

export const getChannels = async () => {
	const response = await ApiSdk.get("/bff/v1/apps/block-cutter/channels/");
	return response.data;
};

export const getObsidianToThinkGeneratePromptList = async () => {
	const response = await ApiSdk.get("/bff/v1/apps/block-cutter/get-studio-obsidian-to-think-generate-prompt-list/");
	return response.data;
};

export const runDifyFlow = async (values: any) => {
   values.channel_id = parseInt(values.channel_id);
   values.prompt_id = parseInt(values.prompt_id);
   values.knowledge_is_required = parseInt(values.knowledge_is_required);
   values.documents = values.documents || [];
   values.if_run_doc_intro_workflow = parseInt(values.if_run_doc_intro_workflow);
   values.if_create_vector_db=parseInt(values.if_create_vector_db);
   values.knowledge_is_required = values.if_create_vector_db >0 ?1:0;
   const valuesTmp= {...values}
   valuesTmp.doc_content=undefined
   new Notice(`开始运行流程 参数\n${JSON.stringify(valuesTmp)}`);
   alert(JSON.stringify(valuesTmp));
	const response = await ApiSdk.post("/bff/v1/apps/dify/tasks/do-obsidian-to-think-workflow",values);
	return response.data;
};
