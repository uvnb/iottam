from PIL import Image
import glob

for img_file in glob.glob("*.jpeg"):
    img = Image.open(img_file)
    img = img.convert("RGBA")
    datas = img.getdata()
    
    newData = []
    for item in datas:
        # If the pixel is close to white (e.g. all RGB > 240)
        if item[0] > 230 and item[1] > 230 and item[2] > 230:
            newData.append((255, 255, 255, 0)) # transparent
        else:
            newData.append(item)
            
    img.putdata(newData)
    img.save(img_file.replace(".jpeg", ".png"), "PNG")
