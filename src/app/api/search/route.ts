import { handleSearch } from "@/lib/api/handlers";
import { withErrorHandling } from "@/lib/api/withErrorHandling";

export const GET = withErrorHandling(handleSearch);
