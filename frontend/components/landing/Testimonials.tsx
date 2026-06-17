"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Reveal } from "@/components/layout/Reveal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

type Review = {
  name: string;
  role: string;
  avatar: string;
  preview: string;
  full: string;
  rating: number;
};

const REVIEWS: Review[] = [
  {
    name: "jasmeensolanki",
    role: "Probability & Statistics · Sem 3",
    avatar: "JS",
    preview: "it's very very use full material for students thanks for material and thankyou so much",
    full: "it's very very use full material for students thanks for material and thankyou so much",
    rating: 5,
  },
  {
    name: "GTU Student",
    role: "Probability & Statistics · Sem 3",
    avatar: "GS",
    preview: "Bhai Bhai Jordar... Thank You Thank You So Much...",
    full: "Bhai Bhai Jordar... Thank You Thank You So Much...",
    rating: 5,
  },
  {
    name: "GTU Student",
    role: "Professional Ethics · Sem 5",
    avatar: "GS",
    preview:
      "This is Not True at all, Any Question you see in Exam Comes from this Site, It's like paper setter is Using this site :)",
    full: "This is Not True at all, Any Question you see in Exam Comes from this Site, It's like paper setter is Using this site :)",
    rating: 5,
  },
  {
    name: "GTU Student",
    role: "Analysis & Design of Algorithms · Sem 5",
    avatar: "GS",
    preview: "It is indeed really helpful thank you so much for the imp's!!",
    full: "It is indeed really helpful thank you so much for the imp's!!",
    rating: 5,
  },
  {
    name: "Harsh",
    role: "Analysis & Design of Algorithms · Sem 5",
    avatar: "H",
    preview: "Really Helpfull",
    full: "Really Helpfull",
    rating: 5,
  },
  {
    name: "krupali sarvaiya",
    role: "Computer Engineering · Sem 2",
    avatar: "KS",
    preview: "its really helpful website",
    full: "its really helpful website",
    rating: 5,
  },
  {
    name: "GTU Student",
    role: "Sem 4 Books · CSE",
    avatar: "GS",
    preview: "Thanks for this type of content. It is so well modularised and easy to navigate too.",
    full: "Thanks for this type of content. It is so well modularised and easy to navigate too.",
    rating: 5,
  },
  {
    name: "Madhav Jajal",
    role: "Computer Engineering · Sem 4",
    avatar: "MJ",
    preview: "Keep going brothers.. you all lit up!!",
    full: "Keep going brothers.. you all lit up!!",
    rating: 5,
  },
  {
    name: "GTU Student",
    role: "PAS Paper Solution",
    avatar: "GS",
    preview: "Very Useful this PAS paper solution to me thanks man",
    full: "Very Useful this PAS paper solution to me thanks man",
    rating: 5,
  },
  {
    name: "GTU Student",
    role: "GTU Material",
    avatar: "GS",
    preview:
      "There are many blogspot related to GTU Examinations but I don't seen before this type of blogspot which have all material, Thanks APY GTU Material",
    full:
      "There are many blogspot related to GTU Examinations but I don't seen before this type of blogspot which have all material, Thanks APY GTU Material",
    rating: 5,
  },
  {
    name: "GTU Student",
    role: "Probability & Statistics · Sem 3",
    avatar: "GS",
    preview: "Good sir thanks u for supporting us love u sir with hearts wala emoji ke saath 💐",
    full: "Good sir thanks u for supporting us love u sir with hearts wala emoji ke saath 💐",
    rating: 5,
  },
  {
    name: "Ravi Kunpara",
    role: "GTU Material",
    avatar: "RK",
    preview: "superb bro social media lead pan chalu kari diyo",
    full: "superb bro social media lead pan chalu kari diyo",
    rating: 5,
  },
];

export function Testimonials() {
  const row = [...REVIEWS, ...REVIEWS];
  return (
    <section className="border-b border-border bg-muted/30 py-24">
      <div className="mx-auto max-w-7xl px-5">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              Loved by students
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
             Students Reviews
            </h2>
          </div>
        </Reveal>
      </div>

      <div className="group relative mt-14 overflow-hidden pb-[20px]">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />
        <div className="flex w-max gap-5 animate-marquee group-hover:[animation-play-state:paused]">
          {row.map((r, i) => (
            <ReviewCard key={i} r={r} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ReviewCard({ r }: { r: Review }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-[340px] shrink-0 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {r.avatar}
        </div>
        <div>
          <div className="text-sm font-semibold">{r.name}</div>
          <div className="text-xs text-muted-foreground">{r.role}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-0.5">
        {Array.from({ length: r.rating }).map((_, i) => (
          <Star key={i} className="size-3.5 fill-spark text-spark" />
        ))}
      </div>
      <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{r.preview}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button type="button" className="mt-4 text-xs font-medium text-brand hover:underline">
            Read more →
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {r.avatar}
              </span>
              <span>
                <span className="block">{r.name}</span>
                <span className="block text-xs font-normal text-muted-foreground">{r.role}</span>
              </span>
            </DialogTitle>
            <DialogDescription className="pt-3 text-sm text-foreground/80">{r.full}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
