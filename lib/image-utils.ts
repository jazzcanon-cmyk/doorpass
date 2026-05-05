export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file
  if (file.size <= 500 * 1024) return file
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > 1200 || height > 1200) {
        const ratio = Math.min(1200 / width, 1200 / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement("canvas")
      canvas.width = width; canvas.height = height
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return }
        const c = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg", lastModified: Date.now() })
        resolve(c.size < file.size ? c : file)
      }, "image/jpeg", 0.75)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}
