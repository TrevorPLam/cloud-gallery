export interface Photo {
  id: string;
  uri: string;
  width: number;
  height: number;
  createdAt: number;
  modifiedAt: number;
  filename: string;
  isFavorite: boolean;
  albumIds: string[];
}

export interface Album {
  id: string;
  title: string;
  coverPhotoUri: string | null;
  photoIds: string[];
  createdAt: number;
  modifiedAt: number;
}

export interface StorageInfo {
  usedBytes: number;
  totalBytes: number;
  photoCount: number;
  albumCount: number;
}

export type DateGroup = {
  title: string;
  data: Photo[];
};
