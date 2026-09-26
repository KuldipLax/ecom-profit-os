import { redirect } from "next/navigation";
import { getCurrentUser,getMemberships } from "@/lib/auth/require-user";
export default async function Home(){const user=await getCurrentUser();if(!user)redirect("/login");const m=await getMemberships(user.id);if(!m.length)redirect("/onboarding");redirect("/dashboard")}
