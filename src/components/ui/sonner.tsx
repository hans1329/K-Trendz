import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      duration={1500}
      toastOptions={{
        style: {
          background: 'linear-gradient(to right, rgba(255, 69, 0, 0.9), rgba(255, 107, 53, 0.9))',
          border: 'none',
          color: 'white',
          backdropFilter: 'blur(8px)',
        },
        classNames: {
          toast: "group toast border-0 shadow-2xl",
          description: "text-white/90",
          actionButton: "bg-white/20 text-white hover:bg-white/30 border-0",
          cancelButton: "bg-white/10 text-white hover:bg-white/20 border-0",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
