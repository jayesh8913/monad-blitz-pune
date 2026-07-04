// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockNFT
 * @dev A self-contained, zero-dependency ERC721 contract representing Hackathon Badges on Monad Testnet.
 */
contract MockNFT {
    string public name = "Monad Hackathon Badge";
    string public symbol = "MHB";
    uint256 public nextTokenId;
    
    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => string) private _tokenURIs;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Minted(address indexed owner, uint256 indexed tokenId, string tokenURI);

    /**
     * @dev Mints a new NFT to the msg.sender.
     * @param uri The token metadata URI.
     */
    function mint(string calldata uri) external returns (uint256) {
        uint256 tokenId = nextTokenId;
        nextTokenId++;

        balanceOf[msg.sender]++;
        ownerOf[tokenId] = msg.sender;
        _tokenURIs[tokenId] = uri;

        emit Transfer(address(0), msg.sender, tokenId);
        emit Minted(msg.sender, tokenId, uri);

        return tokenId;
    }

    /**
     * @dev Returns the metadata URI of a token.
     */
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(ownerOf[tokenId] != address(0), "ERC721: invalid token ID");
        return _tokenURIs[tokenId];
    }
}
