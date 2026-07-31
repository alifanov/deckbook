/**
 * Автор действия: владелец или конкретный агент.
 * `tokenId === null` означает владельца.
 */
export type Actor = { tokenId: string | null };

export const OWNER: Actor = { tokenId: null };

export const agent = (tokenId: string): Actor => ({ tokenId });
