import { PageIndexClient } from "@pageindex/sdk";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { question, documentId, chatModel } = await req.json();
        console.log("Chat Model:", chatModel);
        
        

        if (!question?.trim() || !documentId) {
            return new Response("Missing question or documentId", { status: 400 })
        }


        const client = new PageIndexClient({
            apiKey: process.env.PAGEINDEX_API_KEY!,
        });

        
        const response = await client.api.chatCompletions({
            messages: [{ role: "user", content: question }],
            doc_id: documentId,
          });

        console.log("==========> response:", response);
        console.log("==========> response.choices[0].message.content:", response.choices[0].message.content);


        return NextResponse.json({
            answer: response.choices[0].message.content
        })


    } catch (error) {
        console.error("Error processing question:", error);

        return NextResponse.json({
            answer: "An error occurred while processing your question"
        })
    }
}