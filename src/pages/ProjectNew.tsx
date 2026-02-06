import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { useCreateProject } from "@/hooks/useProject";
import Navbar from "@/components/landing/Navbar";

const schema = z.object({
  pet_name: z.string().min(1, "Your pet needs a name!"),
  pet_type: z.string().min(1, "Please select a pet type"),
  pet_breed: z.string().optional(),
});

type FormValues = { pet_name: string; pet_type: string; pet_breed?: string };

const ProjectNew = () => {
  const createProject = useCreateProject();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { pet_name: "", pet_type: "dog", pet_breed: "" },
  });

  const onSubmit = (values: FormValues) => createProject.mutate(values);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 container mx-auto px-6 lg:px-12 max-w-lg">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <PawPrint className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">Start Your Pet's Story</h1>
            <p className="font-body text-muted-foreground mt-2">Tell us a little about your furry friend</p>
          </div>

          <Card className="rounded-2xl border-border" style={{ boxShadow: "var(--card-shadow)" }}>
            <CardContent className="p-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField control={form.control} name="pet_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-display">Pet's Name</FormLabel>
                      <FormControl><Input placeholder="e.g. Link" className="rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="pet_type" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-display">Type of Pet</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="dog">🐕 Dog</SelectItem>
                          <SelectItem value="cat">🐈 Cat</SelectItem>
                          <SelectItem value="bird">🐦 Bird</SelectItem>
                          <SelectItem value="fish">🐟 Fish</SelectItem>
                          <SelectItem value="rabbit">🐇 Rabbit</SelectItem>
                          <SelectItem value="other">🐾 Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="pet_breed" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-display">Breed <span className="text-muted-foreground font-body text-xs">(optional)</span></FormLabel>
                      <FormControl><Input placeholder="e.g. Golden Retriever" className="rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <Button type="submit" variant="hero" className="w-full rounded-xl" disabled={createProject.isPending}>
                    {createProject.isPending ? "Creating..." : "Continue to Photos →"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};

export default ProjectNew;
