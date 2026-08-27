/** folder.ts — Folder domain model */

export interface FolderEntity {
  folderId: string;
  folderName: string;
  parentFolderId: string;   // 'root' for top-level folders
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}
