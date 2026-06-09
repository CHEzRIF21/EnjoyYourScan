"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  createCategoryAction,
  reorderCategoriesAction,
  type CategoryWithItems,
} from "@/app/(dashboard)/dashboard/menu/actions";
import { CategorySection } from "./category-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "…" : label}
    </Button>
  );
}

interface MenuClientProps {
  initialCategories: CategoryWithItems[];
  canManage: boolean;
}

export function MenuClient({ initialCategories, canManage }: MenuClientProps) {
  // État local pour les mises à jour optimistes du DnD
  const [categories, setCategories] = useState(initialCategories);

  // Synchronise avec les nouvelles données du serveur (après revalidatePath)
  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  // Capteurs DnD : distance min 8 px pour éviter les clics accidentels
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function handleCategoryDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex);

    setCategories(reordered); // mise à jour optimiste
    await reorderCategoriesAction(reordered.map((c) => c.id));
  }

  // Formulaire ajout de catégorie
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [addState, addFormAction] = useFormState(createCategoryAction, {});
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (addState.success) {
      setShowAddCategory(false);
      setFormKey((k) => k + 1);
    }
  }, [addState.success]);

  return (
    <div className="space-y-6">
      {/* ── Formulaire nouvelle catégorie ── */}
      {canManage && (
        <div>
          {showAddCategory ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Nouvelle catégorie</CardTitle>
              </CardHeader>
              <form key={formKey} action={addFormAction}>
                <CardContent className="space-y-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cat-name">Nom *</Label>
                    <Input
                      id="cat-name"
                      name="name"
                      required
                      placeholder="Entrées, Plats, Desserts, Boissons…"
                      autoFocus
                    />
                  </div>
                  {addState.error && (
                    <p className="text-sm text-destructive">{addState.error}</p>
                  )}
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAddCategory(false)}
                  >
                    Annuler
                  </Button>
                  <SubmitBtn label="Créer la catégorie" />
                </CardFooter>
              </form>
            </Card>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowAddCategory(true)}
            >
              + Ajouter une catégorie
            </Button>
          )}
        </div>
      )}

      {/* ── Liste des catégories avec DnD ── */}
      {categories.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">Aucune catégorie pour l&apos;instant.</p>
          {canManage && (
            <p className="text-sm mt-1">
              Créez votre première catégorie pour commencer à composer le menu.
            </p>
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleCategoryDragEnd}
        >
          <SortableContext
            items={categories.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {categories.map((category) => (
                <CategorySection
                  key={category.id}
                  category={category}
                  canManage={canManage}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
