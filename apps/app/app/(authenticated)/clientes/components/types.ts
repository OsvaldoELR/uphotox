export interface ClientSession {
  readonly boardId: number;
  readonly boardName: string;
  readonly id: number;
  readonly sessionAt: string | null;
  readonly stageName: string;
  readonly title: string;
}

export interface ClientListItem {
  readonly createdAt: string;
  readonly email: string | null;
  readonly fullName: string;
  readonly id: number;
  readonly notes: string | null;
  readonly phone: string | null;
  /** Cards of this client the member can see, newest first. */
  readonly sessions: ClientSession[];
}

export interface ClientsAccess {
  readonly canDeleteCards: boolean;
  readonly canImport: boolean;
  readonly canManage: boolean;
}
