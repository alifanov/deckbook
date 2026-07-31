/**
 * Автор действия: владелец или конкретный агент.
 * `tokenId === null` означает владельца.
 */
export type Author = { tokenId: string | null };

export const OWNER: Author = { tokenId: null };

export const agent = (tokenId: string): Author => ({ tokenId });
