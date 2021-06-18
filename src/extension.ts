import * as vscode from 'vscode';
import * as path from 'path';

const createFile = (path: vscode.Uri, content: string) => {
	const wsedit = new vscode.WorkspaceEdit();
	wsedit.createFile(path, { overwrite: true, ignoreIfExists: true });

	const edit = vscode.TextEdit.insert(new vscode.Position(0,0), content);
	wsedit.set(path, [edit]);
	vscode.workspace.applyEdit(wsedit);
	vscode.workspace.openTextDocument(vscode.Uri.parse(path.toString())).then((doc: vscode.TextDocument) => {
		vscode.window.showTextDocument(doc).then(e => {
			e.edit(edit => {
				edit.insert(new vscode.Position(0, 0), content);
			});
		});
	}, (error: any) => {
		console.error(error);
	});
};

enum IncludeGuard {
	Pragma,
	Define,
	None
};

const createContent = (className: string,
					   header: boolean,
					   filename: string,
					   guard: IncludeGuard = IncludeGuard.None,
					   headerExtension: string): string => {
	let content = header ?
`class ${className}
{
public:
	${className}();
	~${className}() = default;
};
`:
`#include "${filename}${headerExtension}"

${className}::${className}()
{
}
`;
	if (header) {
		switch (guard) {
			case IncludeGuard.Define:
				let header_ext = headerExtension.replace(/./, '');
				const def = (filename + "_" + header_ext).toUpperCase();
				content = `#ifndef ${def}\n#define ${def}\n\n${content}\n\n#endif // ${def}`
				break;

			case IncludeGuard.Pragma:
				content = `#pragma once\n\n${content}`;
				break;

			case IncludeGuard.None:
				break;
		}
	}

	return content;
}

interface ClassInfo {
	className: string;
	includeGuard: IncludeGuard;
	headerExtension: string;
}

const getClassInfo = async (label: string, desc: string): Promise<ClassInfo> => {

	const options: vscode.InputBoxOptions = {
		placeHolder: label,
		prompt: desc
	};
	
	const classname = await vscode.window.showInputBox(options);
	const guardValue = await vscode.window.showQuickPick(["Pragma once", "Define", "None"], { canPickMany: false });
	const headerExtension = await vscode.window.showQuickPick([".h", ".hpp"], { canPickMany: false });
	
	let includeGuard = IncludeGuard.None;

	if (!headerExtension)
		return Promise.reject();

	 if (guardValue == "Pragma once")
		includeGuard = IncludeGuard.Pragma;
	else if (guardValue == "Define")
		includeGuard = IncludeGuard.Define;
	
	if (classname && guardValue)
		return {
			className: classname,
			includeGuard: includeGuard,
			headerExtension: headerExtension
		};
	else
		return Promise.reject();
}

export async function activate(context: vscode.ExtensionContext) {

	let disposable = vscode.commands.registerCommand('cxx-tools.createclass', async () => {
		try {
			const options: vscode.SaveDialogOptions = {
				title: 'Create class'
			};

			const classInfo = await getClassInfo('Class name', 'Enter class name');			
	
			vscode.window.showSaveDialog(options).then(uri => {
				if (!uri) return;
				const headerUri = vscode.Uri.parse(uri.toString() + classInfo.headerExtension);
				const sourceUri = vscode.Uri.parse(uri.toString() + '.cpp');
				const filename = path.basename(uri.toString());

				createFile(headerUri, createContent(classInfo.className, true , filename, classInfo.includeGuard, classInfo.headerExtension));
				createFile(sourceUri, createContent(classInfo.className, false, filename, classInfo.includeGuard, classInfo.headerExtension));
			});
			
			vscode.window.showInformationMessage('Created class: ' + classInfo.className);
		} catch (error) {
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
