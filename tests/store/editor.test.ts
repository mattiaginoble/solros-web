import { beforeEach, describe, expect, it } from "vitest";
import { createHouse, createRectRoom } from "@/domain/factory";
import { useEditor } from "@/store/editor";

function fresh() {
  const house = createHouse("Test");
  house.floors[0].rooms.push(createRectRoom(300, 300, { name: "A" }));
  useEditor.getState().load(house, { projectId: "p1" });
  return house;
}

describe("store dell'editor", () => {
  beforeEach(() => {
    fresh();
  });

  it("ogni modifica è annullabile e ripetibile", () => {
    const s = useEditor.getState();
    const roomId = s.house.floors[0].rooms[0].id;
    s.updateRoom(roomId, (r) => ({ ...r, name: "B" }));
    s.updateRoom(roomId, (r) => ({ ...r, name: "C" }));
    expect(useEditor.getState().house.floors[0].rooms[0].name).toBe("C");
    useEditor.getState().undo();
    expect(useEditor.getState().house.floors[0].rooms[0].name).toBe("B");
    useEditor.getState().undo();
    expect(useEditor.getState().house.floors[0].rooms[0].name).toBe("A");
    useEditor.getState().redo();
    expect(useEditor.getState().house.floors[0].rooms[0].name).toBe("B");
  });

  it("un trascinamento (transazione) diventa un solo passo di annullamento", () => {
    const s = useEditor.getState();
    const roomId = s.house.floors[0].rooms[0].id;
    s.begin();
    for (let i = 1; i <= 20; i++) useEditor.getState().updateRoom(roomId, (r) => ({ ...r, x: i * 10 }));
    useEditor.getState().commit();
    expect(useEditor.getState().house.floors[0].rooms[0].x).toBe(200);
    expect(useEditor.getState().past).toHaveLength(1);
    useEditor.getState().undo();
    expect(useEditor.getState().house.floors[0].rooms[0].x).toBe(0);
  });

  it("annullare una transazione ripristina lo stato iniziale", () => {
    const s = useEditor.getState();
    const roomId = s.house.floors[0].rooms[0].id;
    s.begin();
    useEditor.getState().updateRoom(roomId, (r) => ({ ...r, x: 99 }));
    useEditor.getState().cancel();
    expect(useEditor.getState().house.floors[0].rooms[0].x).toBe(0);
    expect(useEditor.getState().past).toHaveLength(0);
  });

  it("dopo un annullamento la selezione di un elemento sparito viene azzerata", () => {
    const room = createRectRoom(200, 200, { name: "Nuova" });
    useEditor.getState().apply((h) => {
      h.floors[0].rooms.push(room);
    });
    useEditor.getState().select({ kind: "room", roomId: room.id });
    useEditor.getState().focusRoom(room.id);
    useEditor.getState().undo();
    expect(useEditor.getState().selection).toBeNull();
    expect(useEditor.getState().mode).toBe("house");
  });

  it("in sola lettura le modifiche vengono ignorate", () => {
    const house = createHouse("Sola lettura");
    useEditor.getState().load(house, { readOnly: true });
    useEditor.getState().apply((h) => {
      h.name = "Cambiato";
    });
    expect(useEditor.getState().house.name).toBe("Sola lettura");
  });

  it("ogni modifica incrementa la revisione usata dall'autosalvataggio", () => {
    const before = useEditor.getState().revision;
    useEditor.getState().apply((h) => {
      h.name = "Altro";
    });
    expect(useEditor.getState().revision).toBe(before + 1);
  });
});
