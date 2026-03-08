import { useState, useCallback } from 'react';

interface UseFormStateOptions<T> {
  initialData: T;
}

interface UseFormStateReturn<T> {
  /** Whether the add form is open */
  isAdding: boolean;
  /** ID of the item being edited, or null */
  editingId: number | null;
  /** Current form data */
  formData: T;
  /** Whether a submit operation is in progress */
  isSubmitting: boolean;
  /** Open the add form with initial/empty data */
  startAdd: () => void;
  /** Open the edit form with existing data */
  startEdit: (id: number, data: T) => void;
  /** Close the form and reset all state */
  cancelForm: () => void;
  /** Set form data directly */
  setFormData: React.Dispatch<React.SetStateAction<T>>;
  /** Update a single field on the form data (only works when T is an object) */
  updateField: (field: keyof T, value: T[keyof T]) => void;
  /** Set the submitting state */
  setIsSubmitting: (v: boolean) => void;
  /** Reset form data to initial values without closing the form */
  resetForm: () => void;
  /** Whether any form (add or edit) is currently open */
  isFormOpen: boolean;
}

/**
 * useFormState
 * Consolidates the repeated add/edit form state pattern used across
 * admin detail tabs (ContactsTab, NotesTab, etc.).
 *
 * Manages isAdding, editingId, formData, and isSubmitting in one hook
 * instead of 4+ separate useState calls per component.
 */
export function useFormState<T>({ initialData }: UseFormStateOptions<T>): UseFormStateReturn<T> {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<T>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startAdd = useCallback(() => {
    setFormData(initialData);
    setEditingId(null);
    setIsAdding(true);
  }, [initialData]);

  const startEdit = useCallback((id: number, data: T) => {
    setFormData(data);
    setEditingId(id);
    setIsAdding(false);
  }, []);

  const cancelForm = useCallback(() => {
    setFormData(initialData);
    setEditingId(null);
    setIsAdding(false);
  }, [initialData]);

  const updateField = useCallback((field: keyof T, value: T[keyof T]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData(initialData);
  }, [initialData]);

  const isFormOpen = isAdding || editingId !== null;

  return {
    isAdding,
    editingId,
    formData,
    isSubmitting,
    startAdd,
    startEdit,
    cancelForm,
    setFormData,
    updateField,
    setIsSubmitting,
    resetForm,
    isFormOpen
  };
}
