export async function withRequiredEconomicContext<
  Context,
  Result,
>(
  requireContext: () => Promise<Context>,
  execute: (context: Context) => Promise<Result>,
): Promise<Result> {
  // The economic callback is unreachable unless readiness succeeds.
  const context = await requireContext()

  return execute(context)
}
