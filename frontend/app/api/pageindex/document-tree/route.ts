
import { PageIndexClient } from "@pageindex/sdk";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const documentId = req.nextUrl.searchParams.get("documentId") as string;


        // Upload File to Page Index

        const client = new PageIndexClient({
            apiKey: process.env.PAGEINDEX_API_KEY!,
        });

        const tree = await client.api.getTree(documentId);
        console.log("Tree:", tree);
        if (tree.status === "completed") {
            console.log("Tree:", tree.result);
        }

        return NextResponse.json({
            success: true,
            tree: tree.result,
        });

    } catch (error) {
        console.error("Error processing document:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}