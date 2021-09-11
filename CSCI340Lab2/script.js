$(document).ready(function() {
  var cardName;
  $("#randomCard").click(function(){
    $.ajax({
      dataType: "json",
      jsonCallback: "parseQuote",
      url: "https://db.ygoprodeck.com/api/v7/randomcard.php",
      success: function(results) {
        console.log(results["name"]);
        console.log(results["card_images"][0]["image_url"]);
        cardName = results["name"];
        document.getElementById("cardName").innerHTML = results["name"];
        $('#cardPic').attr("src", results["card_images"][0]["image_url"]).height('300px').width('200px');
      },
      error: function(xhr,status,error) {
        console.log(error);
      },
    })
  })

  $('#getTitle').click(function(){
    var noSpace = cardName.replace(/\s/g, '');
    $.ajax({
      dataType: "json",
      jsonCallback: "parseQuote",
      url: `https://api.deezer.com/search?q=${noSpace}`,
      success: function(results){
        console.log(results);
        document.getElementById("songTitle").innerHTML = results["title"];
        $('#songMusic').attr("src", results["picture"]).height('300px').width('300px');
        document.getElementById("songPreview").innerHTML = results["preview"];
      },
      error: function(xhr,status,error){
        console.log(error);
        console.log("no song");
      },
    })
  })
})
