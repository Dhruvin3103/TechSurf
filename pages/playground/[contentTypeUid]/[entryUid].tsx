import { useRef, useState } from "react";
import { useImmer } from "use-immer";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import Canvas, { Field } from "../../../components/drag_and_drop/canvas";
import Sidebar, {
  SidebarField,
} from "../../../components/drag_and_drop/sidebar";
import { FieldType } from "../../../components/drag_and_drop/fields";
import styles from "../../../styles/playground.module.css";
import Trash from "../../../components/drag_and_drop/trash";
import RightPanel from "../../../components/drag_and_drop/rightpanel";
import { GetServerSideProps } from "next/types";
import {
  getSpecificContentTypeRes,
  getSpecificEntry,
  publishEntry,
  updateEntry,
} from "../../../helper";
import { ContentType } from "../../contenttype/[uid]";
import { PageProps } from "../../../typescript/layout";

import { initializeComponent } from "../../../typescript/componentInitializer";
import Button from "../../../components/button";

// Define the structure of your data state
interface DataState {
  fields: FieldType[];
}

interface PlaygroundProps {
  contentType: ContentType;
  entry: PageProps;
}

// Helper function to get data from draggable elements
function getData(prop: any) {
  return prop?.data?.current ?? {};
}

// Function to create a spacer field
function createSpacer({ id }: { id: string }): FieldType {
  return {
    id,
    type: "spacer",
    title: "spacer",
  };
}

const getInitialContentype = (entry: PageProps): FieldType[] => {
  console.log(entry);
  const fields: FieldType[] = [];
  if (entry.title) {
    fields.push({
      id: "title",
      type: "text",
      title: "Title",
      content: entry.title,
      fixed: true
    });
  }

  if (entry.url) {
    fields.push({
      id: "url",
      type: "url",
      title: "URL",
      content: entry.url,
      fixed: true
    });
  }

  // Transform page_components array if it exists
  if (entry.page_components && Array.isArray(entry.page_components)) {
    entry.page_components.forEach((component, index) => {
      const componentType = Object.keys(component)[0];

      fields.push({
        id: `${componentType}_${index}`,
        type: componentType,
        title: componentType
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
        content: component,
      });
    });
  }

  // Add other entry fields
  // Object.entries(entry).forEach(([key, value]) => {
  //   if (
  //     key !== "tags" &&
  //     key !== "locale" &&
  //     key !== "ACL" &&
  //     key !== "_verison" &&
  //     key !== "title" &&
  //     key !== "url" &&
  //     key !== "page_components" &&
  //     !key.startsWith("$") && // Skip system fields
  //     typeof value !== "object"
  //   ) {
  //     console.log(key,value);
  //     fields.push({
  //       id: key,
  //       type: typeof value === "string" ? "text" : "input",
  //       title: key.charAt(0).toUpperCase() + key.slice(1),
  //       content: value,
  //     });
  //   }
  // });

  return fields;
};

export default function App({ contentType, entry }: PlaygroundProps) {
  const [sidebarFieldsRegenKey, setSidebarFieldsRegenKey] = useState<number>(
    Date.now()
  );
  const spacerInsertedRef = useRef<boolean>(false);
  const currentDragFieldRef = useRef<FieldType | null>(null);
  const [activeSidebarField, setActiveSidebarField] =
    useState<FieldType | null>(null);
  const [activeField, setActiveField] = useState<FieldType | null>(null);
  const [selectedField, setSelectedField] = useState<FieldType | null>(null);
  const initialFields = getInitialContentype(entry);
  const [isSaving, setIsSaving] = useState(false);

  const transformFieldsToApiFormat = (fields: FieldType[]) => {
    console.log(fields);
    const transformedData: any = {
      title: "",
      url: "",
      page_components: [],
    };

    fields.forEach((field) => {
      if (field.type === "text" && field.id === "title") {
        transformedData.title = field.content;
      } else if (field.type === "url" && field.id === "url") {
        transformedData.url = field.content;
      } else if (!["text", "url"].includes(field.type)) {
        const transformedComponent = processImagesAndOmitOtherUids(
          field.content
        );
        if (isObject(transformedComponent)) {
          // Only add objects to page_components
          transformedData.page_components.push(transformedComponent);
        }
      }
    });

    console.log(transformedData);
    return transformedData;
  };

  // Helper function to replace image objects with UIDs and keep other fields as-is
  const processImagesAndOmitOtherUids = (data: any): any => {
    if (Array.isArray(data)) {
      // Process each item in the array recursively
      return data.map(processImagesAndOmitOtherUids);
    } else if (typeof data === "object" && data !== null) {
      if (isImageObject(data)) {
        // If it's an image object, keep only the UID
        return data.uid;
      } else {
        // Otherwise, omit any 'uid' key and process recursively
        const transformed: any = {};
        for (const key in data) {
          if (key !== "uid") {
            transformed[key] = processImagesAndOmitOtherUids(data[key]);
          }
        }
        return transformed;
      }
    }
    return data; // Return primitive values as-is
  };

  // Helper function to detect image objects
  const isImageObject = (obj: any): boolean => {
    return (
      typeof obj === "object" &&
      obj !== null &&
      "uid" in obj &&
      "url" in obj &&
      "filename" in obj // Check for essential image keys
    );
  };

  const isObject = (value: any): boolean => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  };

  // Use useImmer with a defined type for the state
  const [data, updateData] = useImmer<DataState>({
    fields: initialFields,
  });

  // Cleanup function to reset states
  const cleanUp = () => {
    setActiveSidebarField(null);
    setActiveField(null);
    currentDragFieldRef.current = null;
    spacerInsertedRef.current = false;
  };

  // Handle drag start event
  const handleDragStart = (e: any) => {
    const { active } = e;
    const activeData = getData(active);

    if (activeData.fromSidebar) {
      const { field } = activeData;
      const initializedComponent = initializeComponent(field.type);
      setActiveSidebarField(field);
      currentDragFieldRef.current = initializedComponent;
      return;
    }

    const { field, index } = activeData;

    setActiveField(field);
    currentDragFieldRef.current = field;
    updateData((draft: DataState) => {
      draft.fields.splice(index, 1, createSpacer({ id: active.id }));
    });
  };

  // Handle drag over event
  const handleDragOver = (e: any) => {
    console.log(e, "over");
    const { active, over } = e;
    const activeData = getData(active);

    if (activeData.fromSidebar) {
      const overData = getData(over);

      if (!spacerInsertedRef.current) {
        const spacer = createSpacer({
          id: `${active.id}-spacer`,
        });

        updateData((draft: DataState) => {
          if (!draft.fields.length) {
            draft.fields.push(spacer);
          } else {
            const nextIndex =
              overData.index > -1 ? overData.index : draft.fields.length;
            draft.fields.splice(nextIndex, 0, spacer);
          }
          spacerInsertedRef.current = true;
        });
      } else if (!over) {
        updateData((draft: DataState) => {
          draft.fields = draft.fields.filter((f) => f.type !== "spacer");
        });
        spacerInsertedRef.current = false;
      } else {
        updateData((draft: DataState) => {
          const spacerIndex = draft.fields.findIndex(
            (f) => f.id === `${active.id}-spacer`
          );
          const nextIndex =
            overData.index > -1 ? overData.index : draft.fields.length - 1;

          if (nextIndex === spacerIndex) {
            return;
          }

          draft.fields = arrayMove(draft.fields, spacerIndex, nextIndex);
        });
      }
    }
  };

  // Handle drag end event
  const handleDragEnd = (e: any) => {
    const { over } = e;

    if (!over) {
      cleanUp();
      updateData((draft: DataState) => {
        draft.fields = draft.fields.filter((f) => f.type !== "spacer");
      });
      return;
    }

    let nextField = currentDragFieldRef.current;

    if (nextField) {
      const overData = getData(over);

      updateData((draft: DataState) => {
        const spacerIndex = draft.fields.findIndex((f) => f.type === "spacer");
        draft.fields.splice(spacerIndex, 1, nextField);
        draft.fields = arrayMove(
          draft.fields,
          spacerIndex,
          overData.index || 0
        );
      });
    }

    setSidebarFieldsRegenKey(Date.now());
    cleanUp();
    setSelectedField(null);
  };

  const handleFieldSelect = (field: FieldType) => {
    console.log(field);
    setSelectedField(field);
  };

  const handleUpdateField = (updatedField: FieldType) => {
    updateData((draft: DataState) => {
      console.log("updating ", draft);
      const index = draft.fields.findIndex((f) => f.id === updatedField.id);
      if (index !== -1) {
        draft.fields[index] = {
          ...draft.fields[index],
          ...updatedField,
          content: updatedField.content,
        };
        console.log("updated draft : ", draft.fields[index]);
      }
    });
    setSelectedField(updatedField);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const transformedData = transformFieldsToApiFormat(data.fields);
      console.log(transformedData);
      await updateEntry(contentType.uid, entry.uid, transformedData);
      alert("Changes saved successfully!");
    } catch (error) {
      console.error("Error saving changes:", error);
      alert("Failed to save changes. Please try again.");
    } finally {
      // await publishEntry(contentType.uid,entry.uid);
      setIsSaving(false);
    }
  };
  const { fields } = data;
  // console.log(JSON.stringify(fields));

  return (
    <div className="h-screen overflow-hidden">
      <div className="h-full">
        <DndContext
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          autoScroll
        >
          <div className="flex h-screen">
            <div className={`${styles.customScrollbar} pb-[70px] w-1/4 overflow-y-auto border-r-2`}>
              <Sidebar
                fieldsRegKey={String(sidebarFieldsRegenKey)}
                contentType={contentType}
              />
            </div>

            {/* center canvas */}
            <div className="w-3/4 flex flex-col h-full">
              <div className={`${styles.customScrollbar} flex-1 overflow-hidden pb-24`}>
                <SortableContext
                  strategy={verticalListSortingStrategy}
                  items={fields.map((f: FieldType) => f.id)}
                >
                  <Canvas fields={fields} onFieldSelect={handleFieldSelect} />
                </SortableContext>
              </div>
              {/* <Trash /> */}

              <div className="absolute bottom-0 left-0 right-0 p-2 bg-white border-t">
            <div className="flex justify-center">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg text-xl 
                ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
              </div>
            </div>

            <DragOverlay>
              {activeSidebarField ? (
                <SidebarField overlay field={activeSidebarField} />
              ) : null}
              {activeField ? <Field overlay field={activeField} /> : null}
            </DragOverlay>
            <div className={`${styles.customScrollbar} w-1/4 overflow-y-auto border-l pb-10`}>
            <RightPanel
              selectedComponent={selectedField}
              onUpdateComponent={handleUpdateField}
            />
            </div>
          </div>
        </DndContext>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { contentTypeUid, entryUid } = context.query;
  const content_type = await getSpecificContentTypeRes(contentTypeUid);
  const entry_page = await getSpecificEntry(contentTypeUid, entryUid);

  return {
    props: {
      contentType: content_type,
      entry: entry_page,
    },
  };
};
