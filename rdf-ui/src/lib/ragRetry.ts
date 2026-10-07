export async function withRagSessionRetry<T>(
  authenticated: boolean,
  operation: () => Promise<T>,
  refreshSession: () => Promise<void>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!authenticated) throw error;
    await refreshSession();
    return operation();
  }
}
