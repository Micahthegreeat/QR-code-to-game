
import qrcode
from qrcode.constants import ERROR_CORRECT_L
from qrcode.util import QRData, MODE_ALPHA_NUM

'''
this generates a qr code from the given url it only supports 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:
any lower case characters automatically gets put into uppercase
this qr code can hold 4,296 characters if the url starts with https://qr.micahknox.com/#/ then can hold 4,269 characters
'''
def generate_qr(url, filename="qrcode.png"):
    # QR alphanumeric mode supports only these characters
    allowed = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:"

    # Validate input
    if any(char not in allowed for char in url.upper()):
        raise ValueError(
            "URL contains unsupported characters. "
            "Alphanumeric mode only supports uppercase letters, "
            "numbers, spaces, and $%*+-./:"
        )

    # Create QR code with automatic version sizing
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_L,
        box_size=10,
        border=4
    )

    # Force alphanumeric encoding
    qr.add_data(
        QRData(url.upper(), mode=MODE_ALPHA_NUM),
        optimize=0
    )

    # Find smallest version that fits (max version 40)
    qr.make(fit=True)

    if qr.version > 40:
        raise ValueError("URL exceeds QR code maximum capacity")

    # Generate and save image
    img = qr.make_image(
        fill_color="black",
        back_color="white"
    )
    img.save(filename)

    print(f"QR code saved to: {filename}")
    print(f"QR version: {qr.version}")
    print(f"Error correction: L")
    print(f"Encoding: Alphanumeric")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("-o", "--output", default="qrcode.png")

    args = parser.parse_args()

    generate_qr(args.url, args.output)
