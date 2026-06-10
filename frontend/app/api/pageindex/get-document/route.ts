
import { PageIndexClient } from "@pageindex/sdk";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const documentId = req.nextUrl.searchParams.get("documentId") as string;


        // Upload File to Page Index

        const client = new PageIndexClient({
            apiKey: process.env.PAGEINDEX_API_KEY!,
        });

        const document = await client.api.getDocument(documentId);
        console.log("Document:", document);

        return NextResponse.json({
            success: true,
            document: document,
        });

    } catch (error) {
        console.error("Error processing document:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}