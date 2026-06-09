"use client";

import { useCallback, useEffect, useState } from "react";
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import { GripVertical, Clock, ChevronDown, ChevronRight } from "lucide-react";
import {
  updateCategoryAction,
  deleteCategoryAction,
  toggleCategoryActiveAction,
  toggleItemAvailabilityAction,
  deleteItemAction,
  reorderItemsAction,
  type CategoryWithItems,
  type MenuItem,
} from "@/app/(dashboard)/dashboard/menu/actions";
import { ItemForm } from "./item-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ─────────────────────────────────────────────
// Helpers partagés
// ─────────────────────────────────────────────
function SubmitBtn({
  label,
  variant = "default",
  size = "sm",
}: {
  label: string;
  variant?: "default" | "destructive" | "ghost" | "outline" | "secondary";
  size?: "sm" | "default";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending}>
      {pending ? "…" : label}
    </Button>
  );
}

function AlertMsg({ state }: { state: { error?: string } }) {
  if (!state.error) return null;
  return <p className="text-xs text-destructive">{state.error}</p>;
}

// ─────────────────────────────────────────────
// Formulaire édition catégorie (inline)
// ─────────────────────────────────────────────
function EditCategoryForm({
  category,
  onCancel,
}: {
  category: CategoryWithItems;
  onCancel: () => void;
}) {
  const [state, formAction] = useFormState(updateCategoryAction, {});

  useEffect(() => {
    if (state.success) onCancel();
  }, [state.success, onCancel]);

  return (
    <form action={formAction} className="flex flex-1 items-center gap-2">
      <input type="hidden" name="category_id" value={category.id} />
      <Input
        name="name"
        defaultValue={category.name}
        required
        autoFocus
        className="h-7 text-sm flex-1"
      />
      <SubmitBtn label="OK" />
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        ✕
      </Button>
      <AlertMsg state={state} />
    </form>
  );
}

// ─────────────────────────────────────────────
// Suppression catégorie avec confirmation
// ─────────────────────────────────────────────
function DeleteCategoryForm({ categoryId }: { categoryId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useFormState(deleteCategoryAction, {});

  return (
    <form action={formAction} className="inline-flex flex-col gap-1 items-end">
      <input type="hidden" name="category_id" value={categoryId} />
      {confirming ? (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Supprimer ?</span>
          <SubmitBtn label="Oui" variant="destructive" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(false)}
          >
            Non
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirming(true)}
        >
          Supprimer
        </Button>
      )}
      <AlertMsg state={state} />
    </form>
  );
}

// ─────────────────────────────────────────────
// Toggle disponibilité d'un plat
// ─────────────────────────────────────────────
function ToggleAvailabilityForm({ item }: { item: MenuItem }) {
  const [, formAction] = useFormState(toggleItemAvailabilityAction, {});
  return (
    <form action={formAction}>
      <input type="hidden" name="item_id" value={item.id} />
      <input type="hidden" name="is_available" value={String(item.is_available)} />
      <SubmitBtn
        label={item.is_available ? "Disponible" : "Indisponible"}
        variant={item.is_available ? "outline" : "secondary"}
      />
    </form>
  );
}

// ─────────────────────────────────────────────
// Suppression d'un plat avec confirmation
// ─────────────────────────────────────────────
function DeleteItemForm({ itemId }: { itemId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useFormState(deleteItemAction, {});

  return (
    <form action={formAction} className="inline-flex flex-col gap-1 items-end">
      <input type="hidden" name="item_id" value={itemId} />
      {confirming ? (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Supprimer ?</span>
          <SubmitBtn label="Oui" variant="destructive" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(false)}
          >
            Non
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive px-2"
          onClick={() => setConfirming(true)}
        >
          ✕
        </Button>
      )}
      <AlertMsg state={state} />
    </form>
  );
}

// ─────────────────────────────────────────────
// Carte d'un plat (triable)
// ─────────────────────────────────────────────
function ItemCard({
  item,
  canManage,
}: {
  item: MenuItem;
  canManage: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [isEditing, setIsEditing] = useState(false);
  const handleCancelEdit = useCallback(() => setIsEditing(false), []);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-card transition-shadow ${
        isDragging ? "opacity-50 shadow-lg z-50" : ""
      }`}
      {...attributes}
    >
      {isEditing ? (
        <div className="p-2">
          <ItemForm
            categoryId={item.category_id}
            item={item}
            onCancel={handleCancelEdit}
          />
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3">
          {/* Poignée drag */}
          {canManage && (
            <button
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 p-0.5"
              aria-label="Réorganiser"
            >
              <GripVertical size={14} />
            </button>
          )}

          {/* Photo */}
          {item.photo_url && (
            <div className="relative shrink-0 h-12 w-12 rounded-md overflow-hidden border bg-muted">
              <Image
                src={item.photo_url}
                alt={item.name}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          )}

          {/* Infos */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium truncate">{item.name}</p>
              {!item.is_available && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  Indisponible
                </Badge>
              )}
            </div>
            {item.description && (
              <p className="text-xs text-muted-foreground truncate">
                {item.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-sm font-semibold tabular-nums">
                {new Intl.NumberFormat("fr-FR").format(Number(item.price))}
              </span>
              {item.prep_time_minutes && (
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <Clock size={10} />
                  {item.prep_time_minutes} min
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          {canManage && (
            <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
              <ToggleAvailabilityForm item={item} />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                Modifier
              </Button>
              <DeleteItemForm itemId={item.id} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Section catégorie (triable) + plats (triables)
// ─────────────────────────────────────────────
interface CategorySectionProps {
  category: CategoryWithItems;
  canManage: boolean;
}

export function CategorySection({ category, canManage }: CategorySectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  // État local des plats pour les mises à jour optimistes du DnD
  const [items, setItems] = useState<MenuItem[]>(category.items);
  useEffect(() => {
    setItems(category.items);
  }, [category.items]);

  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleCancelAddItem = useCallback(() => setShowAddItem(false), []);
  const handleCancelEditCategory = useCallback(
    () => setIsEditingCategory(false),
    []
  );

  // DnD plats (capteur propre à cette catégorie)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);

    setItems(reordered);
    await reorderItemsAction(
      category.id,
      reordered.map((i) => i.id)
    );
  }

  // Toggle is_active catégorie
  const [activeState, activeFormAction] = useFormState(
    toggleCategoryActiveAction,
    {}
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-50" : ""}
      {...attributes}
    >
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Poignée drag catégorie */}
            {canManage && (
              <button
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
                aria-label="Réorganiser la catégorie"
              >
                <GripVertical size={16} />
              </button>
            )}

            {isEditingCategory ? (
              <EditCategoryForm
                category={category}
                onCancel={handleCancelEditCategory}
              />
            ) : (
              <>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <h2
                    className={`font-semibold text-base truncate ${
                      !category.is_active ? "text-muted-foreground line-through" : ""
                    }`}
                  >
                    {category.name}
                  </h2>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {items.length} plat{items.length !== 1 ? "s" : ""}
                  </Badge>
                  {!category.is_active && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      Masquée
                    </Badge>
                  )}
                </div>

                {canManage && (
                  <div className="flex items-center gap-1">
                    {/* Toggle visibilité catégorie */}
                    <form action={activeFormAction}>
                      <input
                        type="hidden"
                        name="category_id"
                        value={category.id}
                      />
                      <input
                        type="hidden"
                        name="is_active"
                        value={String(category.is_active)}
                      />
                      <SubmitBtn
                        label={category.is_active ? "Masquer" : "Afficher"}
                        variant="ghost"
                      />
                    </form>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingCategory(true)}
                    >
                      Renommer
                    </Button>
                    <DeleteCategoryForm categoryId={category.id} />
                  </div>
                )}

                {/* Collapse toggle */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCollapsed((c) => !c)}
                  aria-label={isCollapsed ? "Développer" : "Réduire"}
                  className="shrink-0"
                >
                  {isCollapsed ? (
                    <ChevronRight size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </Button>
              </>
            )}
          </div>
        </CardHeader>

        {!isCollapsed && (
          <CardContent className="pt-0 space-y-2">
            <Separator className="mb-3" />

            {/* Liste des plats avec DnD */}
            {items.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleItemDragEnd}
              >
                <SortableContext
                  items={items.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {items.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        canManage={canManage}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucun plat dans cette catégorie.
              </p>
            )}

            {/* Formulaire ajout de plat */}
            {canManage && (
              <div className="pt-2">
                {showAddItem ? (
                  <ItemForm
                    categoryId={category.id}
                    onCancel={handleCancelAddItem}
                  />
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed"
                    onClick={() => setShowAddItem(true)}
                  >
                    + Ajouter un plat
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
