import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4 pointer-events-auto", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4 w-full",
        caption: "flex justify-center pt-1 relative items-center mb-4",
        caption_label: "text-base font-semibold",
        caption_dropdowns: "flex gap-2 items-center",
        dropdown: "appearance-none bg-background border border-input rounded-md px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer",
        dropdown_month: "mr-1",
        dropdown_year: "",
        vhidden: "sr-only",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex w-full justify-between",
        head_cell: "text-muted-foreground w-10 font-medium text-sm py-2 text-center",
        row: "flex w-full justify-between mt-1",
        cell: "w-10 h-10 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day: cn(buttonVariants({ variant: "ghost" }), "h-10 w-10 p-0 font-normal aria-selected:opacity-100 rounded-full"),
        day_range_end: "day-range-end rounded-full",
        day_selected:
          "bg-primary text-white hover:bg-primary/90 focus:bg-primary focus:text-white rounded-full",
        day_today: "bg-accent text-accent-foreground font-semibold rounded-full",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:opacity-100 rounded-full",
        day_disabled: "text-muted-foreground opacity-50 rounded-full",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground rounded-full",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
