import { render } from "@react-email/components";
import { GalleryReadyTemplate } from "@repo/email/templates/gallery-ready";
import { SelectionReceivedTemplate } from "@repo/email/templates/selection-received";
import { StageUpdateTemplate } from "@repo/email/templates/stage-update";
import { describe, expect, test } from "vitest";

describe("gallery emails with a book and a canvas", () => {
  test("«Tus fotos están listas» says what the client will choose", async () => {
    const html = await render(
      <GalleryReadyTemplate
        clientName="Ana"
        deadline="24 de diciembre"
        extraPrice="$20"
        includedCount={24}
        products="Tu paquete incluye un libro 8×11 y un canvas 16×20: al terminar de elegir tus favoritas escogerás entre ellas la portada y la contraportada del libro y la foto del canvas."
        selectionUrl="https://example.com/g/x"
        sessionTitle="Mateo"
        studioName="Estudio"
      />
    );

    expect(html).toContain(
      "Tu paquete incluye un libro 8×11 y un canvas 16×20"
    );
  });

  test("«Selección recibida» lists the covers and the canvas photo", async () => {
    const html = await render(
      <SelectionReceivedTemplate
        cardTitle="Mateo"
        clientName="Ana"
        galleryUrl="https://example.com/galerias/1"
        includedCount={24}
        picked={24}
        products={[
          "Libro 11×8 horizontal · portada IMG_0001 · contraportada IMG_0002",
          "Canvas 16×20 vertical · IMG_0005",
        ]}
        studioName="Estudio"
      />
    );

    expect(html).toContain("Libro y canvas");
    expect(html).toContain(
      "Libro 11×8 horizontal · portada IMG_0001 · contraportada IMG_0002"
    );
    expect(html).toContain("Canvas 16×20 vertical · IMG_0005");
  });

  test("without products nothing changes", async () => {
    const html = await render(
      <SelectionReceivedTemplate
        cardTitle="Mateo"
        clientName="Ana"
        galleryUrl="https://example.com/galerias/1"
        includedCount={12}
        picked={12}
        studioName="Estudio"
      />
    );

    expect(html).not.toContain("Libro y canvas");
  });

  test("the email on confirming carries the full gallery offer", async () => {
    const html = await render(
      <StageUpdateTemplate
        clientName="Ana"
        message="Recibimos tu selección."
        offer={{
          note: "Todas las fotos de tu sesión sin editar, solo con un retoque de color básico.",
          price: "$100",
          whatsappUrl: "https://wa.me/13055550123?text=galeria",
        }}
        stageName="Escogidas"
        studioName="Estudio"
      />
    );

    expect(html).toContain("¿Quieres todas las fotos de tu sesión?");
    expect(html).toContain("Precio: $100");
    expect(html).toContain("https://wa.me/13055550123?text=galeria");
  });
});
