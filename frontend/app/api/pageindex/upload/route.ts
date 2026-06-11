import { PageIndexClient } from "@pageindex/sdk";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return new Response("No File provided", { status: 400 });
        }


        // Upload File to Page Index

        const client = new PageIndexClient({
            apiKey: process.env.PAGEINDEX_API_KEY!,
        });

        const document = await client.api.submitDocument(file, file.name);

        const tree = await client.api.getTree(document.doc_id);
        
        if (tree.status === "completed") {
            console.log("Tree:", tree.result);
        }

        return NextResponse.json({
            success: true,
            documentId: document.doc_id,
            summary: "",
            pageCount: 0,
        });

    } catch (error) {
        console.error("Error processing document:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}
